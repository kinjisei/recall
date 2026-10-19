// ============================================================================
// Энергия в тексте — иконка bolt, а не символ ⚡ (лист s4, «Иконки»): символ
// у каждой системы свой (жёлтый эмодзи на телефоне, чёрно-белый на
// компьютере), иконка — одна и цвета текста. Единица энергии в данных и
// строках остаётся «⚡» (правило billing: одна единица на весь продукт);
// выводит её этот компонент. Сам символ остаётся в тексте невидимым — для
// чтения с экрана и копирования («1 ⚡»), иконка от чтения скрыта.
// ============================================================================
import { Fragment } from 'react'
import { IconBolt } from './icons'

/** Одна иконка энергии в строке текста, ростом с букву. */
export function Bolt({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex align-[-0.125em] ${className}`}>
      <IconBolt aria-hidden className="size-[1.1em]" />
      <span className="sr-only">⚡</span>
    </span>
  )
}

/** Строка, где «⚡» — единица энергии: каждый символ становится иконкой. */
export function BoltText({ children }: { children: string }) {
  const parts = children.split('⚡')
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && <Bolt />}
        </Fragment>
      ))}
    </>
  )
}
