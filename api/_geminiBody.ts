// ============================================================================
// Тело запроса к Gemini под конкретную модель — общее для обычного и
// потокового вызова (api/_core.ts). Файл с «_» — Vercel НЕ делает из него
// отдельную функцию. Вынесено из _core.ts, когда туда пришли сроки ожидания
// (PLAN.md Ф1.10): вызов, фолбэки и сроки — там, сборка тела — здесь.
// ============================================================================
import type { ChatTurn } from '../src/shared/api/aiTypes.js'
import type { AiTier } from './_core.js'

/**
 * Системная инструкция для Gemma (у неё нет systemInstruction) — ОТДЕЛЬНОЙ
 * парой реплик в начале переписки, а не подклейкой в текст сообщения.
 *
 * История вопроса (2026-07-24): инструкцию вклеивали в первое user-сообщение
 * («инструкция --- текст»). Gemma принимала её за содержание разговора и
 * отвечала разбором задания: пересказывала правила, писала план, самопроверку
 * («Plain text? Yes. No emojis? Yes.») и дублировала реплику — всё это лезло
 * пользователю в чат «Диалога». Обрамление границами не спасло: модель просто
 * добавила запрет «no meta-talk» в свой же пересказ правил и продолжила.
 * Работает другое: инструкция подаётся как УЖЕ состоявшийся обмен репликами
 * (пользователь дал правила — модель их приняла), и разбирать в ответе нечего.
 */
function gemmaPreamble(systemText: string): { role: string; parts: { text: string }[] }[] {
  return [
    { role: 'user', parts: [{ text: systemText }] },
    {
      role: 'model',
      parts: [{ text: 'Понял правила. Дальше выдаю только сам ответ, без пояснений о правилах.' }],
    },
  ]
}

/** Роль-контент для API: system-реплики отдельно, остальное — в contents. */
export function splitMessages(
  messages: ChatTurn[],
  system: string | undefined,
): { systemText: string; contents: { role: string; parts: { text: string }[] }[] } {
  const systemText = [
    system ?? '',
    ...messages.filter((m) => m.role === 'system').map((m) => m.content),
  ]
    .filter(Boolean)
    .join('\n\n')
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
  return { systemText, contents }
}

/**
 * Тело запроса под конкретную модель. Общее для обычного и потокового вызова —
 * иначе настройки генерации (температура, потолок, «размышления») разошлись бы.
 * У Gemma нет systemInstruction: инструкцию подаём отдельной парой реплик.
 *
 * Настройки зависят от уровня задачи (наблюдение владельца 24.07: упираемся в
 * ЧИСЛО запросов, не в токены, поэтому токены не жалеем ради качества):
 *   lite     — перевод слова: низкая температура, короткий ответ, без
 *              «размышлений» — быстро;
 *   standard — Диалог/письмо/разбор: «размышления» включены, ответ длиннее;
 *   max      — материалы/программа: самый большой потолок ответа.
 */
export function geminiBody(
  model: string,
  systemText: string,
  contents: { role: string; parts: { text: string }[] }[],
  tier: AiTier,
): string {
  const isGemma = model.startsWith('gemma')
  const isThinkingModel = model.startsWith('gemini-2.5')
  const gen: Record<string, unknown> =
    tier === 'lite'
      ? {
          temperature: 0.2,
          maxOutputTokens: 1024,
          ...(isThinkingModel ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        }
      : {
          temperature: 0.7,
          maxOutputTokens: tier === 'max' ? 8192 : 4096,
        }
  const body: Record<string, unknown> = {
    contents:
      isGemma && systemText && contents.length > 0
        ? [...gemmaPreamble(systemText), ...contents]
        : contents,
    generationConfig: gen,
  }
  if (systemText && !isGemma) body.systemInstruction = { parts: [{ text: systemText }] }
  return JSON.stringify(body)
}
