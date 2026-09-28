// ============================================================================
// Vercel serverless: POST /api/gemini  { messages, system?, task, stream? }  ->  { text }
// Ключ берётся ТОЛЬКО из серверной env-переменной GEMINI_API_KEY
// (Vercel → Project → Settings → Environment Variables). В коде фронта его нет.
// Тот же обработчик обслуживает /api/gemini и в dev (vite.config.ts).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ChatTurn } from '../src/shared/api/aiTypes.js'
// расширение .js обязательно: "type": "module" — Vercel/Node в ESM-режиме
// не находит модуль без расширения (FUNCTION_INVOCATION_FAILED при старте)
import { callGemini, streamGemini, GEMINI_TIER_CHAINS } from './_core.js'
import { groqChat, GROQ_MODELS } from './_groq.js'
import { authorize, applyCors, authDenied, isTeacher, UNAVAILABLE } from './_auth.js'
import { taskSpec } from './_tasks.js'
import { startCall } from './_usage.js'
import { TIMEOUTS, chainTime, windowUntil, workDeadline, type Timeouts } from './_timeouts.js'

// Генерация материала занимает 20–40 с (два запроса к Gemini), плюс повторы
// при 503. Дефолтные 10 с Vercel обрывали её раньше времени.
export const config = { maxDuration: 60 }

/**
 * Бюджет минуты (числа — api/_timeouts.ts): работа кончается к 52-й секунде
 * (60 − 3 запас − 5 на итог с возвратом энергии), а цепочка Gemini — к 40-й,
 * чтобы Groq-у как последнему рубежу осталось его окно в 12 с.
 */
const LIMITS: Timeouts = { ...TIMEOUTS, functionMs: config.maxDuration * 1000 }

// Лимиты на вход — отсекают злоупотребление токенами (сжигание бесплатной квоты).
const MAX_MESSAGES = 50
const MAX_TOTAL_CHARS = 40_000
const MAX_SYSTEM_CHARS = 12_000

// Лёгкие задачи (перевод слова, определение) — ВСЕГДА один короткий запрос.
// Жёсткий потолок для них закрывает подмену кармана квоты: без него можно было
// прислать полноценный 20-репличный Диалог с task:'word' и списать его из
// дешёвого light-кармана вместо энергии. Легальный lite-запрос — одно
// сообщение; 4 сообщения / 8000 символов — с запасом.
const MAX_MESSAGES_LITE = 4
const MAX_TOTAL_CHARS_LITE = 8_000

export default function handler(req: VercelRequest, res: VercelResponse) {
  return handle(req, res)
}

/** Сам обработчик. Сроки — параметром: тест гоняет те же пути за доли секунды. */
export async function handle(req: VercelRequest, res: VercelResponse, t: Timeouts = LIMITS) {
  const startedAt = Date.now()
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' })

  const { messages, system, task, stream } = (req.body ?? {}) as {
    messages?: ChatTurn[]
    system?: string
    task?: string
    /** Клиент просит потоковый ответ (пока только «Диалог»). */
    stream?: boolean
  }

  // Модель выбирает СЕРВЕР по типу задачи (карта — api/_tasks.ts). Клиент
  // присылает только название задачи: подделав его, можно получить ровно ту
  // модель, что закреплена за чужой задачей, а не «самую умную по заказу».
  // От задачи зависит и класс квоты (переводы слов не съедают энергию).
  // Прежний путь tier/provider (клиенты до захода 18, июль 2026) убран в
  // Ф1.6: такой запрос — просто неизвестная задача.
  const spec = taskSpec(task)
  if (!spec) return res.status(400).json({ error: 'Неизвестная задача для AI' })
  const tier = spec.tier

  // Валидация входа ДО списания квоты: иначе кривой/пустой запрос (баг клиента,
  // повторная отправка по таймауту) уже жёг бы энергию без единого ответа AI.
  // Плюс lite-задачам — жёсткий потолок (см. MAX_*_LITE).
  const msgCap = tier === 'lite' ? MAX_MESSAGES_LITE : MAX_MESSAGES
  const charCap = tier === 'lite' ? MAX_TOTAL_CHARS_LITE : MAX_TOTAL_CHARS
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Нужно поле messages (непустой массив)' })
  }
  if (messages.length > msgCap) {
    return res.status(400).json({ error: 'Слишком много сообщений в запросе' })
  }
  const totalChars = messages.reduce(
    (n, m) => n + (typeof m?.content === 'string' ? m.content.length : 0),
    0,
  )
  if (totalChars > charCap) {
    return res.status(400).json({ error: 'Слишком большой запрос' })
  }
  if (typeof system === 'string' && system.length > MAX_SYSTEM_CHARS) {
    return res.status(400).json({ error: 'Слишком большая системная инструкция' })
  }

  // Задачи преподавателя — только ему. Проверяем ДО списания: это задачи-
  // генерации, и для не-учителя лимит генераций пула = 0, то есть authorize
  // вернул бы 429 «лимит генераций» вместо понятного 403. Проверка роли ничего
  // не стоит по энергии, поэтому перебора она не поощряет.
  if (spec.teacherOnly) {
    const teacher = await isTeacher(req, t.supabaseMs)
    if (teacher === null) return res.status(UNAVAILABLE.status).json({ error: UNAVAILABLE.error })
    if (!teacher) return res.status(403).json({ error: 'Эта функция доступна только преподавателю.' })
  }

  const access = await authorize(req, spec.quota, spec.energyCost, spec.generation ?? false, t.supabaseMs)
  if (authDenied(access)) {
    return res.status(access.status).json({ error: access.error })
  }

  // Энергия уже списана. Дальше действует правило: НЕ ДОСТАВИЛИ ОТВЕТ — НЕ
  // БЕРЁМ ПЛАТУ. Итог каждого вызова — в журнал (api/_usage.ts); без ответа
  // тот же запрос возвращает энергию.
  // Сроки: всё, кроме итога с возвратом, кончается к endBy. Цепочка Gemini, за
  // которой ещё стоит Groq, кончается раньше — на его окно.
  const endBy = workDeadline(startedAt, t)
  const call = startCall(req, {
    token: access.refundToken,
    task: String(task),
    tier,
    logMs: t.logMs,
    supabaseMs: t.supabaseMs,
    refundBy: endBy + t.supabaseMs,
  })
  const { trace } = call

  const apiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY
  const geminiBy = groqKey ? endBy - t.groqMs : endBy
  if (!apiKey && !groqKey) {
    await call.finish('failed')
    // имя переменной окружения наружу не отдаём — это подсказка для атакующего
    return res.status(500).json({ error: 'AI на сервере не настроен. Мы уже знаем и чиним.' })
  }

  /** Ответ есть: сначала итог в журнал, потом ответ (почему так — api/_usage.ts). */
  const answer = async (text: string) => {
    await call.finish('ok')
    return res.status(200).json({ text })
  }

  const fail = async (e: unknown, fallbackMsg: string) => {
    await call.finish('failed')
    const msg = e instanceof Error ? e.message : fallbackMsg
    return res.status(msg.includes('лимит') || msg.includes('исчерпан') ? 429 : 502).json({ error: msg })
  }

  /** Отказ без ответа модели — тоже возвращаем списание. */
  const unavailable = async () => {
    await call.finish('failed')
    return res.status(502).json({
      error: 'AI сейчас не отвечает. Энергия не потрачена — попробуй через минуту.',
    })
  }

  try {
    // lite: мгновенный Groq первым (перевод слова — слабой модели достаточно),
    // Gemini-lite цепочка — запасной путь
    if (tier === 'lite') {
      if (groqKey) {
        try {
          const ms = windowUntil(endBy, t.attemptMs.lite)
          return await answer(await groqChat(messages, system, groqKey, GROQ_MODELS.fast, ms, trace))
        } catch {
          /* Groq лёг/лимит/завис — уходим на Gemini-lite */
        }
      }
      if (!apiKey) return await unavailable()
      const chain = GEMINI_TIER_CHAINS.lite
      const time = chainTime(t, 'lite', endBy)
      return await answer(await callGemini(messages, system, apiKey, chain[0], chain.slice(1), 'lite', time, trace))
    }

    // Потоковый «Диалог»: ответ льётся кусками по мере генерации — начинает
    // появляться сразу, а не ждётся целиком. Только task='dialog' (остальные
    // standard-задачи отдают JSON целиком) и только по явной просьбе клиента
    // (stream:true). Энергия по правилу владельца: доставили полный ответ —
    // берём; не завершился (ни слова / оборвался) — возвращаем.
    if (stream === true && task === 'dialog' && apiKey) {
      const chain = GEMINI_TIER_CHAINS[tier]
      // у потока нет Groq-рубежа — ему вся минута до итога с возвратом
      const time = chainTime(t, tier, endBy)
      const gen = streamGemini(messages, system, apiKey, chain[0], chain, tier, time, trace)
      let first
      try {
        first = await gen.next() // до первого куска можно упасть — тогда возврат
      } catch (e) {
        return await fail(e, 'Ошибка AI') // ни слова не пришло — возврат + JSON-ошибка
      }
      if (first.done) return await unavailable() // пустой ответ — возврат
      // Первый кусок есть — фиксируем 200 и льём поток.
      res.status(200)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.write(first.value)
      try {
        for await (const chunk of gen) res.write(chunk)
      } catch {
        // Оборвалось или встало после первого куска — итог «оборвался» и
        // возврат энергии, а соединение РВЁМ, а не закрываем чисто: иначе
        // клиент примет обрывок за целый ответ (статус 200 уже ушёл, другого
        // сигнала у нас нет). Сначала возврат — после ответа функцию могут и
        // не дождаться.
        await call.finish('cut')
        res.destroy()
        return
      }
      // поток завершился STOP — ответ доставлен, плату оставляем; итог — до
      // конца ответа, по той же причине
      await call.finish('ok')
      res.end()
      return
    }

    // standard/max: Gemini-цепочка уровня, терминальный фолбэк — Groq.
    const chain = GEMINI_TIER_CHAINS[tier]
    if (apiKey) {
      try {
        const time = chainTime(t, tier, geminiBy)
        return await answer(await callGemini(messages, system, apiKey, chain[0], chain, tier, time, trace))
      } catch (e) {
        if (!groqKey) return await fail(e, 'Ошибка Gemini')
        /* вся Gemini-цепочка легла или не успела — последний рубеж Groq */
      }
    }
    if (!groqKey) return await unavailable()
    const ms = windowUntil(endBy, t.groqMs)
    return await answer(await groqChat(messages, system, groqKey, GROQ_MODELS.last, ms, trace))
  } catch (e) {
    return await fail(e, 'Ошибка AI')
  }
}
