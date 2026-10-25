// ============================================================================
// Данные о слове для читалки — одни на шторку (телефон, задания) и панель
// перевода сбоку текста (компьютер, макет d6): перевод именно в этом
// предложении (Gemini), для английского — транскрипция, часть речи, пример и
// звук из словаря (статья начальной формы, если нажата другая: «habits» →
// «habit»; в карточку — только от её слова); «в мои слова». Быстрая смена слова не даёт медленному
// ответу по прошлому слову перезаписать данные актуального (alive-флаг).
// ============================================================================
import { useEffect, useState } from 'react'
import { addCard } from '../lib/cards'
import { lookup, type DictionaryResult } from '../lib/dictionary'
import { lookupInContext, type ContextLookup } from '../lib/contextDict'
import { logActivity } from '../lib/activity'
import { speak } from '../lib/speech'
import type { AppLang } from '../types'

/** Часть речи словаря (англ.) — по-русски, как в макете d6: «глагол». */
const POS_RU: Record<string, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adjective: 'прилагательное',
  adverb: 'наречие',
  pronoun: 'местоимение',
  preposition: 'предлог',
  conjunction: 'союз',
  interjection: 'междометие',
  determiner: 'определитель',
  'phrasal verb': 'фразовый глагол',
}

/** Слово так, как его записывает словарь (`lookup` → `word`). */
const dictForm = (w: string) => w.trim().toLowerCase().replace(/[^a-z'-]/g, '')

export function posRu(pos: string | undefined): string | undefined {
  if (!pos) return undefined
  return POS_RU[pos.toLowerCase()] ?? undefined
}

export interface WordLookup {
  ctx: ContextLookup | null
  ctxError: boolean
  ipa?: string
  /** Часть речи по-русски, если словарь знает. */
  pos?: string
  /** Пример из словаря (английский). */
  example?: string
  added: boolean
  busy: boolean
  error: string | null
  /** Начальная форма отличается от нажатого слова («withstood → withstand»). */
  baseDiffers: boolean
  playAudio: () => void
  addToDeck: () => Promise<void>
}

/** Найденное о слове — с ключом слова: ответ по прошлому слову к новому не прилипает. */
interface Found {
  key: string
  ctx: ContextLookup | null
  ctxError: boolean
  ipa?: string
  pos?: string
  example?: string
  audioUrl?: string
  /** Для какого слова статья словаря: нажатого или начальной формы («habits» → «habit»). */
  dictWord?: string
}

const dictPatch = (r: DictionaryResult): Partial<Found> => ({
  ipa: r.ipa,
  audioUrl: r.audio_url,
  pos: posRu(r.definitions?.[0]?.pos),
  example: r.example,
  dictWord: r.word,
})

export function useWordLookup(word: string, sentence: string, lang: AppLang, onAdded?: (front: string, back: string) => void): WordLookup {
  const key = `${lang}|${word}|${sentence}`
  const [found, setFound] = useState<Found>({ key: '', ctx: null, ctxError: false })
  // «в мои слова» — тоже по ключу: новое слово начинает с чистого листа
  const [save, setSave] = useState<{ key: string; added: boolean; busy: boolean; error: string | null }>({ key: '', added: false, busy: false, error: null })

  useEffect(() => {
    let alive = true
    const merge = (patch: Partial<Found>, keep?: (f: Found) => boolean) =>
      alive &&
      setFound((prev) => {
        const f = prev.key === key ? prev : { key, ctx: null, ctxError: false }
        return keep?.(f) ? f : { ...f, ...patch }
      })
    lookupInContext(word, sentence, lang)
      .then((ctx) => {
        merge({ ctx })
        // словарь не знает форм («habits», «withstood») — статья начальной
        // формы; она же главнее: в карточку уходит начальная форма
        if (lang === 'en' && dictForm(ctx.base) !== dictForm(word)) {
          lookup(ctx.base)
            .then((r) => r && merge(dictPatch(r)))
            .catch(() => {})
        }
      })
      .catch(() => merge({ ctxError: true }))
    if (lang === 'en') {
      lookup(word)
        .then((r) => r && merge(dictPatch(r), (f) => !!f.dictWord && f.dictWord !== r.word))
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [key, word, sentence, lang])

  const cur: Found = found.key === key ? found : { key, ctx: null, ctxError: false }
  const st = save.key === key ? save : { key, added: false, busy: false, error: null }
  const { ctx } = cur

  // звук словаря — только если статья про это же слово: на «withstood» не говорить «withstand»
  const playAudio = () => {
    if (cur.audioUrl && cur.dictWord === dictForm(word)) new Audio(cur.audioUrl).play().catch(() => speak(word, { lang }))
    else speak(word, { lang })
  }

  const addToDeck = async () => {
    setSave({ key, added: false, busy: true, error: null })
    const front = ctx?.base ?? word.toLowerCase()
    const back = ctx ? ctx.translation + (ctx.note ? ` · ${ctx.note}` : '') : ''
    // транскрипция и звук в карточке — от её слова, а не от нажатой формы
    const same = cur.dictWord === dictForm(front)
    try {
      await addCard({
        front,
        back: back || undefined,
        example: sentence,
        ipa: same ? cur.ipa : undefined,
        audio_url: same ? cur.audioUrl : undefined,
        lang,
        source: 'reader',
      })
      setSave({ key, added: true, busy: false, error: null })
      onAdded?.(front, back)
      void logActivity('reader')
    } catch (e) {
      setSave({ key, added: false, busy: false, error: e instanceof Error ? e.message : 'Не удалось добавить слово' })
    }
  }

  const baseDiffers = !!ctx && ctx.base.toLowerCase() !== word.toLowerCase().replace(/[’]/g, "'")
  return {
    ctx,
    ctxError: cur.ctxError,
    ipa: cur.ipa,
    pos: cur.pos,
    example: cur.example,
    added: st.added,
    busy: st.busy,
    error: st.error,
    baseDiffers,
    playAudio,
    addToDeck,
  }
}
