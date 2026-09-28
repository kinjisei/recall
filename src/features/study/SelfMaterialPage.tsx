// ============================================================================
// «Собрать материал под себя» (роут /self-material) — режим самоучки, блок 3b.
// Ученик сам заказывает текст с упражнениями под тему и уровень; AI собирает,
// материал сохраняется и назначается САМОМУ СЕБЕ, дальше открывается в
// /assignments обычным раннером.
//
// Задача уходит как self_material (lib/materials, req.self): не teacherOnly,
// тратит СВОЙ месячный лимит генераций (у соло-Premium он есть, у Free = 0 —
// сервер честно скажет про Premium). studentId = свой uid, поэтому материал
// подстраивается под собственную диагностику (буксующие слова, слабые темы).
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSmartBack } from '../../shared/ui/SmartBack'
import { Button } from '../../shared/ui/Button'
import { Picker } from '../../shared/ui/Picker'
import { Thinking } from '../../shared/ui/Thinking'
import { IconBack } from '../../shared/ui/icons'
import { useLanguage } from '../../context/LanguageContext'
import { currentUserId } from '../../shared/api/supabase'
import { getCachedEnLevel } from '../../lib/profile'
import { createSelfMaterial, MATERIAL_FORMATS, MATERIAL_LENGTHS } from '../../lib/materials'
import type { CEFRLevel } from '../../types'

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1']
const LEN_LABEL: Record<(typeof MATERIAL_LENGTHS)[number], string> = {
  '50-100': 'короткий (50–100 слов)',
  '100-250': 'средний (100–250)',
  '250-350': 'длинный (250–350)',
}

const inputCls =
  'w-full rounded-xl border border-white/[0.10] bg-[var(--night-input)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--night-accent-45)]'

export function SelfMaterialPage() {
  const goBack = useSmartBack('/study')
  const nav = useNavigate()
  const { lang } = useLanguage()
  const cached = (getCachedEnLevel() as CEFRLevel | null) ?? null

  const [level, setLevel] = useState<CEFRLevel>(cached && LEVELS.includes(cached) ? cached : 'A2')
  const [topic, setTopic] = useState('')
  const [format, setFormat] = useState<string>(MATERIAL_FORMATS[1]) // рассказ
  const [len, setLen] = useState<(typeof MATERIAL_LENGTHS)[number]>('100-250')
  const [grammar, setGrammar] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const make = async () => {
    if (!topic.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const uid = await currentUserId()
      if (!uid) throw new Error('Нужно войти в аккаунт.')
      await createSelfMaterial({
        lang,
        level,
        topic: topic.trim(),
        format,
        lengthRange: len,
        vocabulary: '',
        grammar: grammar.trim(),
        studentId: uid,
      })
      // материал уже назначен себе — открываем список заданий, где он и лежит
      nav('/assignments', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось собрать материал. Попробуй ещё раз.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <button
          onClick={goBack}
          aria-label="Назад"
          className="lift -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--night-text-70)]"
        >
          <IconBack size={20} />
        </button>
        <h1 className="text-2xl font-medium tracking-tight">Материал под себя</h1>
      </header>

      <p className="text-sm text-[var(--night-text-40)]">
        AI соберёт текст с упражнениями под твою тему и уровень — и подстроит его под твои слабые
        места. Готовый материал появится в «Домашке». Тратит месячный лимит генераций (на Premium).
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sm-topic" className="text-sm font-medium">
          О чём текст
        </label>
        <input
          id="sm-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Например: поход в горы, собеседование, космос"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Уровень</span>
          <Picker
            value={level}
            onChange={setLevel}
            label="Уровень"
            options={LEVELS.map((l) => ({ id: l, label: l }))}
          />
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Длина</span>
          <Picker
            value={len}
            onChange={setLen}
            label="Длина текста"
            options={MATERIAL_LENGTHS.map((l) => ({ id: l, label: LEN_LABEL[l] }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Формат</span>
        <Picker
          value={format}
          onChange={setFormat}
          label="Формат текста"
          options={MATERIAL_FORMATS.map((f) => ({ id: f, label: f }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sm-grammar" className="text-sm font-medium">
          Грамматика (необязательно)
        </label>
        <input
          id="sm-grammar"
          value={grammar}
          onChange={(e) => setGrammar(e.target.value)}
          placeholder="Например: Past Simple, артикли"
          className={inputCls}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <Button className="w-full py-3" disabled={!topic.trim() || busy} loading={busy} onClick={make}>
        {busy ? <Thinking label="Собираю материал" /> : 'Собрать материал'}
      </Button>
    </div>
  )
}
