// ============================================================================
// «Выдать слова ученику»: готовые паки приложения ИЛИ свои колоды.
//
// Раньше учитель мог выдать только СВОИ слова — готовые паки (4844 английских,
// 4668 испанских) были доступны только самому ученику. Теперь оба источника
// живут в одной шторке и работают одинаково: выбрал набор → посмотрел состав →
// снял лишнее → выдал.
//
// Слова уходят в ЛИЧНУЮ колоду ученика (lib/teacher.assignWordsToStudent),
// поэтому сразу видны в его прогрессе и доступны для перепроверки. Что уже
// есть — показано с пометкой и снятой галкой; окончательный отсев дублей всё
// равно делает сервер.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { IconClose, IconSearch } from '../../components/icons'
import { Loading, RowsSkeleton } from '../../components/Loading'
import { useLanguage } from '../../context/LanguageContext'
import { assignWordsToStudent, getMyDecks, listDeckCards } from '../../lib/teacher'
import {
  loadPacks,
  packCategory,
  PACK_CATEGORY_LABEL,
  PACK_LEVELS,
  type LoadedPacks,
  type PackWord,
} from '../../lib/wordPacks'
import { describeDbError } from '../../lib/dbError'
import type { AppLang, CEFRLevel, Deck, WordTopic } from '../../types'

const SEARCH_FROM = 20 // поиск показываем только на длинных списках

type Source = 'packs' | 'mine'

/** Выбранный набор: тема пака или своя колода. */
type Chosen =
  | { kind: 'topic'; id: number; title: string }
  | { kind: 'deck'; id: string; title: string }

export function WordPicker({
  studentId,
  studentLevel,
  /** Слова, которые у ученика уже есть: front → статус (для пометок). */
  known,
  onClose,
  onAssigned,
}: {
  studentId: string
  studentLevel: CEFRLevel | null
  known: Map<string, string>
  onClose: () => void
  onAssigned: (added: number) => void
}) {
  const { lang: appLang } = useLanguage()
  // ⚠️ Свой переключатель языка: студия языком НЕ управляет (карточка ученика и
  // «Слова» показывают всё сразу), поэтому опираться на шапку нельзя — учитель
  // с английским в шапке не должен оставаться без испанских паков.
  const [lang, setLang] = useState<AppLang>(appLang)
  const [source, setSource] = useState<Source>('packs')
  const [chosen, setChosen] = useState<Chosen | null>(null)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="animate-fade-up flex max-h-[88dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />

        <div className="flex items-start justify-between gap-2 px-5 pt-1">
          <div className="min-w-0">
            <h2 className="text-lg font-medium">
              {chosen ? chosen.title : 'Выдать слова'}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--night-text-40)]">
              {chosen
                ? 'Сними лишние — остальные уйдут ученику'
                : 'Готовые наборы приложения или твои собственные'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[var(--night-text-40)]"
          >
            <IconClose size={18} />
          </button>
        </div>

        {chosen ? (
          <WordList
            key={`${chosen.kind}:${chosen.id}`}
            chosen={chosen}
            lang={lang}
            studentId={studentId}
            known={known}
            onBack={() => setChosen(null)}
            onAssigned={onAssigned}
          />
        ) : (
          <SetList
            lang={lang}
            setLang={setLang}
            source={source}
            setSource={setSource}
            studentLevel={studentLevel}
            onChoose={setChosen}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Шаг 1: выбор набора
// ---------------------------------------------------------------------------

function SetList({
  lang,
  setLang,
  source,
  setSource,
  studentLevel,
  onChoose,
}: {
  lang: AppLang
  setLang: (l: AppLang) => void
  source: Source
  setSource: (s: Source) => void
  studentLevel: CEFRLevel | null
  onChoose: (c: Chosen) => void
}) {
  const [packs, setPacks] = useState<LoadedPacks | null>(null)
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [query, setQuery] = useState('')
  // ключ раскрытой секции — «категория:уровень»
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setPacks(null)
    loadPacks(lang).then((p) => alive && setPacks(p))
    return () => {
      alive = false
    }
  }, [lang])

  useEffect(() => {
    let alive = true
    getMyDecks()
      .then((d) => alive && setDecks(d))
      .catch(() => alive && setDecks([]))
    return () => {
      alive = false
    }
  }, [])

  // Уровень ученика раскрыт сразу. Если уровень не измерен (у новичков он
  // пустой) — не раскрываем ничего: угадывать уровень мы не беремся нигде.
  useEffect(() => {
    if (!packs || open !== null || !studentLevel) return
    const first = packs.topics.find((t) => t.level === studentLevel)
    if (first) setOpen(`${packCategory(first.name)}:${first.level}`)
  }, [packs, studentLevel, open])

  const q = query.trim().toLowerCase()

  const byCategory = useMemo(() => {
    const cats: Record<string, Record<string, WordTopic[]>> = {}
    if (!packs) return cats
    for (const t of packs.topics) {
      if (q && !t.name.toLowerCase().includes(q)) continue
      const cat = packCategory(t.name)
      ;((cats[cat] ??= {})[t.level] ??= []).push(t)
    }
    return cats
  }, [packs, q])

  const myDecks = (decks ?? []).filter(
    (d) => (d.lang ?? 'en') === lang && (!q || d.title.toLowerCase().includes(q)),
  )

  return (
    <div className="min-h-0 overflow-y-auto px-5 pb-5 pt-3">
      <div className="flex flex-wrap gap-2">
        {(['packs', 'mine'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={chip(source === s)}
          >
            {s === 'packs' ? 'Готовые наборы' : 'Мои наборы'}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-white/[0.10]" aria-hidden />
        {(['en', 'es'] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className={chip(lang === l)}>
            {l === 'en' ? 'EN' : 'ES'}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--night-input)] px-3">
        <IconSearch size={16} className="text-[var(--night-text-40)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти набор…"
          className="h-11 w-full bg-transparent text-[15px] outline-none"
        />
      </label>

      {source === 'mine' ? (
        decks === null ? (
          <div className="mt-3">
            <RowsSkeleton count={3} height={52} />
          </div>
        ) : myDecks.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--night-text-40)]">
            Своих наборов на этом языке нет. Их можно собрать в «Мой словарь», а
            пока рядом есть готовые.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {myDecks.map((d) => (
              <button
                key={d.id}
                onClick={() => onChoose({ kind: 'deck', id: d.id, title: d.title })}
                className="lift rounded-xl border border-white/[0.08] px-3 py-2.5 text-left text-sm"
              >
                {d.title}
              </button>
            ))}
          </div>
        )
      ) : packs === null ? (
        <div className="mt-3">
          <Loading label="Открываем наборы" />
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {(['base', 'themes', 'idioms'] as const).map((cat) => {
            const levels = byCategory[cat]
            if (!levels) return null
            return (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--night-text-40)]">
                  {PACK_CATEGORY_LABEL[cat]}
                </p>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {PACK_LEVELS.filter((l) => levels[l]).map((level) => {
                    const key = `${cat}:${level}`
                    const isOpen = q.length > 0 || open === key
                    const list = levels[level] ?? []
                    return (
                      <div key={key}>
                        <button
                          onClick={() => setOpen(isOpen ? null : key)}
                          className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 text-left text-sm"
                          aria-expanded={isOpen}
                        >
                          <span className="font-medium">
                            {level}
                            {level === studentLevel && (
                              <span className="ml-2 text-xs font-normal text-[var(--night-accent-text)]">
                                уровень ученика
                              </span>
                            )}
                          </span>
                          <span className="text-[var(--night-text-40)]">
                            {list.length} · {isOpen ? '▾' : '▸'}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="mt-1.5 flex flex-col gap-1.5 pl-1">
                            {list.map((t) => (
                              <button
                                key={t.id}
                                onClick={() =>
                                  onChoose({ kind: 'topic', id: t.id, title: t.name })
                                }
                                className="lift rounded-xl border border-white/[0.08] px-3 py-2 text-left text-sm"
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {Object.keys(byCategory).length === 0 && (
            <p className="text-sm text-[var(--night-text-40)]">Ничего не нашлось.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Шаг 2: состав набора и выдача
// ---------------------------------------------------------------------------

function WordList({
  chosen,
  lang,
  studentId,
  known,
  onBack,
  onAssigned,
}: {
  chosen: Chosen
  lang: AppLang
  studentId: string
  known: Map<string, string>
  onBack: () => void
  onAssigned: (added: number) => void
}) {
  const [words, setWords] = useState<PackWord[] | null>(null)
  const [checked, setChecked] = useState<Set<string> | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setWords(null)
    const load = async (): Promise<PackWord[]> => {
      if (chosen.kind === 'deck') {
        const cards = await listDeckCards(chosen.id)
        return cards.map((c) => ({
          front: c.front,
          back: c.back ?? '',
          example: c.example ?? undefined,
        }))
      }
      const packs = await loadPacks(lang)
      return packs.wordsByTopic.get(chosen.id) ?? []
    }
    load()
      .then((w) => {
        if (!alive) return
        setWords(w)
        // По умолчанию отмечено ВСЁ, кроме того, что ученик уже учит: иначе
        // учитель отмечал бы сотню слов руками ради выдачи целой темы.
        setChecked(new Set(w.filter((x) => !known.has(norm(x.front))).map((x) => x.front)))
      })
      .catch((e) => alive && setError(describeDbError(e, 'открыть набор')))
    return () => {
      alive = false
    }
  }, [chosen, lang, known])

  const q = query.trim().toLowerCase()
  const shown = (words ?? []).filter(
    (w) => !q || w.front.toLowerCase().includes(q) || (w.back ?? '').toLowerCase().includes(q),
  )
  const selected = checked?.size ?? 0

  const toggle = (front: string) =>
    setChecked((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(front)) next.delete(front)
      else next.add(front)
      return next
    })

  const assign = async () => {
    if (!words || !checked || checked.size === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const picked = words.filter((w) => checked.has(w.front))
      const added = await assignWordsToStudent(studentId, lang, picked)
      onAssigned(added)
    } catch (e) {
      setError(describeDbError(e, 'выдать слова'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-3">
        <button
          onClick={onBack}
          className="min-h-[44px] text-sm font-medium text-[var(--night-accent-text)] hover:underline"
        >
          ← к наборам
        </button>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {words === null ? (
          <RowsSkeleton count={5} height={44} />
        ) : (
          <>
            {words.length >= SEARCH_FROM && (
              <label className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--night-input)] px-3">
                <IconSearch size={16} className="text-[var(--night-text-40)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Найти слово…"
                  className="h-11 w-full bg-transparent text-[15px] outline-none"
                />
              </label>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs text-[var(--night-text-40)]">
              <button
                onClick={() =>
                  setChecked(new Set((words ?? []).filter((w) => !known.has(norm(w.front))).map((w) => w.front)))
                }
                className="min-h-[44px] font-medium text-[var(--night-accent-text)]"
              >
                отметить все новые
              </button>
              <button
                onClick={() => setChecked(new Set())}
                className="min-h-[44px] font-medium text-[var(--night-accent-text)]"
              >
                снять все
              </button>
            </div>

            <div className="flex flex-col gap-1">
              {shown.map((w) => {
                const has = known.get(norm(w.front))
                const on = checked?.has(w.front) ?? false
                return (
                  <label
                    key={w.front}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(w.front)}
                      className="h-5 w-5 flex-none accent-[var(--night-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{w.front}</span>
                      <span className="block truncate text-xs text-[var(--night-text-40)]">
                        {w.back}
                      </span>
                    </span>
                    {has && (
                      // Не прячем такие слова: учитель должен видеть, что ученик
                      // уже знает из этой темы, а не гадать, почему из ста слов
                      // показано шестьдесят.
                      <span className="flex-none rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-[var(--night-text-40)]">
                        уже учит · {has}
                      </span>
                    )}
                  </label>
                )
              })}
              {shown.length === 0 && (
                <p className="py-4 text-sm text-[var(--night-text-40)]">Ничего не нашлось.</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-none border-t border-white/[0.08] px-5 py-3">
        <Button className="w-full" loading={busy} disabled={selected === 0} onClick={assign}>
          {selected === 0 ? 'Ничего не выбрано' : `Выдать ${selected} слов`}
        </Button>
      </div>
    </>
  )
}

/** Сверка слов ведётся без регистра и краевых пробелов — как на сервере. */
function norm(s: string): string {
  return s.trim().toLowerCase()
}

function chip(active: boolean): string {
  return `min-h-[44px] rounded-xl px-3.5 text-sm font-medium transition-colors ${
    active
      ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
      : 'bg-white/[0.06] text-[var(--night-text-40)]'
  }`
}
