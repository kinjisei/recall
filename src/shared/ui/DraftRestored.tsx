// «Черновик восстановлен · Очистить» под полем, текст которого вернулся из
// черновика (shared/lib/useDraft, PLAN.md Ф1.14). Без строки человек не
// понял бы, откуда в поле текст, и как начать с чистого листа. «Очистить» —
// цель 44 по высоте, а строку не раздвигает (отрицательные поля): в строке-
// flex она не «слово в предложении», и UX-аудит считал её кнопкой 16 px.
export function DraftRestored({ onClear, className = '' }: { onClear: () => void; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs text-fg-muted ${className}`}>
      Черновик восстановлен ·
      <button type="button" onClick={onClear} className="-my-3.5 inline-flex min-h-11 items-center px-1 text-accent-strong underline underline-offset-2">
        Очистить
      </button>
    </p>
  )
}
