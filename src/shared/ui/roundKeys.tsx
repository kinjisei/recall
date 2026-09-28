// ============================================================================
// Клавиатура в упражнениях (журнал п.46): учитель и ученик за ноутбуком
// отвечают, не хватаясь за мышь.
//
//   1–4    — выбрать вариант ответа;
//   Enter  — «Проверить» / «Дальше»;
//   Esc    — выйти из раунда, как стрелка «назад» (решение владельца
//            28.09.2026). Ответы недоигранного раунда пропадают — так же, как
//            при стрелке; повторение карточек сохраняется после каждой.
//
// Чего клавиши НЕ делают, чтобы не мешать:
//   • в поле ввода цифры — это текст, Enter — забота самого поля; первый Esc
//     только снимает курсор с поля, выход — вторым (случайно выйти из
//     диктанта, стирая слово, нельзя);
//   • Enter на кнопке с фокусом — её собственное нажатие (иначе «Дальше»
//     сработало бы дважды и пропустило вопрос);
//   • пока открыта шторка или меню, Esc закрывает их, а не раунд;
//   • с Ctrl/Alt/Cmd и при зажатой клавише — ничего.
//
// Цифра-подсказка на варианте: кнопке достаточно атрибута data-key={i + 1} —
// цифру рисует index.css псевдоэлементом и только при мыши или тачпаде
// (pointer: fine). Не текстом: текст кнопки — это ответ, его сверяют проверки
// и читает экранная читалка.
// ============================================================================
import { useEffect, useRef } from 'react'
import { useFocusMode } from '../lib/focusMode'
import { isSheetOpen } from './Sheet'

export interface RoundKeys {
  /** Цифра n (1–9) → вариант с индексом n − 1. */
  pick?: (index: number) => void
  enter?: () => void
  escape?: () => void
}

export function useRoundKeys(keys: RoundKeys, enabled = true): void {
  // свежие обработчики без переподписки на каждый рендер
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target instanceof HTMLElement ? e.target : null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const k = latest.current

      if (e.key === 'Escape') {
        if (isSheetOpen() || document.querySelector('[role="menu"]')) return
        if (typing) {
          target!.blur()
          return
        }
        if (k.escape) {
          e.preventDefault()
          k.escape()
        }
        return
      }
      if (typing || isSheetOpen()) return
      if (e.key === 'Enter') {
        if (target?.closest('button, a, [role="button"], [role="tab"]')) return
        if (k.enter) {
          e.preventDefault()
          k.enter()
        }
        return
      }
      if (/^[1-9]$/.test(e.key) && k.pick) {
        e.preventDefault()
        k.pick(Number(e.key) - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}

/**
 * Режим раунда целиком: каркас прячет шапку и навигацию (shared/lib/focusMode),
 * Esc выходит из раунда. Одно место на все игры «Практики».
 */
export function useRoundMode(on: boolean, onExit: () => void): void {
  useFocusMode(on)
  useRoundKeys({ escape: onExit }, on)
}
