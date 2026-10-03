// «Черновик восстановлен · Очистить» под полем, текст которого вернулся из
// черновика (shared/lib/useDraft, PLAN.md Ф1.14). Без строки человек не
// понял бы, откуда в поле текст, и как начать с чистого листа.
export function DraftRestored({ onClear, className = '' }: { onClear: () => void; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs text-fg-muted ${className}`}>
      Черновик восстановлен ·
      <button type="button" onClick={onClear} className="text-accent-strong underline underline-offset-2">
        Очистить
      </button>
    </p>
  )
}
