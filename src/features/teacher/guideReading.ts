// ============================================================================
// Где учитель в методичке (макет d9-3, PLAN.md Ф2.17-4в-3): текущий раздел и
// подраздел — для оглавления и «раздел 2 из 4» в шапке, сколько прочитано, какие
// разделы пройдены (галочка в оглавлении). Место и пройденное запоминаются на
// этом устройстве («Прочитано 38% · место запомнится»): вернулся — тот же
// абзац. Разделы — элементы `#guide-<id>`, подразделы в них — `[data-guide-block]`.
// ============================================================================
import { useEffect, useState } from 'react'
import { readJson, writeJson } from '../../shared/lib/storage'

const KEY = 'recall.guide'
/** Линия чтения от верха окна: под закреплённой шапкой (48) с запасом. */
const LINE = 96

interface Saved {
  y: number
  read: string[]
}

export interface GuidePlace {
  /** Индекс текущего раздела в ids. */
  at: number
  /** Подраздел внутри текущего; −1 — ещё вступление раздела. */
  block: number
  /** Прочитано, 0–100. */
  progress: number
}

const load = (): Saved => {
  const s = readJson<Partial<Saved>>(KEY, {})
  return { y: typeof s.y === 'number' ? s.y : 0, read: Array.isArray(s.read) ? s.read.filter((x): x is string => typeof x === 'string') : [] }
}

export function useGuideReading(ids: string[]): GuidePlace & { read: string[] } {
  const [place, setPlace] = useState<GuidePlace>({ at: 0, block: -1, progress: 0 })
  const [read, setRead] = useState<string[]>(() => load().read)
  const key = ids.join(',')

  // вернулись — на прежнее место (кадр спустя: текст уже разложен)
  useEffect(() => {
    const { y } = load()
    if (y <= 0) return
    const f = requestAnimationFrame(() => window.scrollTo(0, y))
    return () => cancelAnimationFrame(f)
  }, [])

  useEffect(() => {
    let frame = 0
    let saveTimer = 0
    const measure = () => {
      frame = 0
      const els = ids.map((id) => document.getElementById(`guide-${id}`))
      let at = 0
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= LINE) at = i
      })
      let block = -1
      els[at]?.querySelectorAll('[data-guide-block]').forEach((el, i) => {
        if (el.getBoundingClientRect().top <= LINE) block = i
      })
      const max = document.documentElement.scrollHeight - window.innerHeight
      const atEnd = max - window.scrollY < 4
      const progress = max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100
      // пройден — низ раздела выше линии чтения; дочитал до конца — все
      const done = ids.filter((_, i) => atEnd || (els[i]?.getBoundingClientRect().bottom ?? Infinity) <= LINE)
      setPlace((p) => (p.at === at && p.block === block && p.progress === progress ? p : { at, block, progress }))
      setRead((prev) => {
        const next = [...new Set([...prev, ...done])]
        return next.length === prev.length ? prev : next
      })
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
      window.clearTimeout(saveTimer)
      saveTimer = window.setTimeout(() => writeJson(KEY, { ...load(), y: Math.round(window.scrollY) }), 400)
    }
    frame = requestAnimationFrame(measure)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(saveTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    // ids — по ключу: новый массив на каждой отрисовке не должен перевешивать слушатели
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // пройденное — сразу на устройство
  useEffect(() => {
    writeJson(KEY, { ...load(), read })
  }, [read])

  return { ...place, read }
}
