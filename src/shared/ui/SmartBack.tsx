// ============================================================================
// «Назад» для отдельно стоящих страниц (тарифы, оферта, политика) — они живут
// ВНЕ каркаса с нижней навигацией, и жёсткая ссылка назад устраивала кольца
// (настройки → тарифы → «назад» → настройки…) или выкидывала на /login.
// Возвращаем туда, откуда пришли (история SPA); если истории нет (открыли по
// прямой ссылке) — на fallback.
// ============================================================================
import { useNavigate } from 'react-router-dom'
import { IconBack } from './icons'

/** Возврат «откуда пришёл», а при прямом заходе/перезагрузке (idx===0) — на
 *  fallback. Голый navigate(-1) на таких страницах выкидывал из приложения. */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate()
  return () => {
    // react-router кладёт idx в history.state: >0 — есть куда вернуться внутри SPA
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }
}

export function SmartBack({ fallback }: { fallback: string }) {
  const goBack = useSmartBack(fallback)
  return (
    <button
      onClick={goBack}
      className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.10]"
      aria-label="Назад"
    >
      <IconBack size={18} />
    </button>
  )
}
