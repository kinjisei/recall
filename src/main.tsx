import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { inject } from '@vercel/analytics'
import App from './App'
import { installErrorLogging } from './lib/errorLog'
import './index.css'

// Обезличенная аналитика посещений (Vercel Web Analytics, бесплатный тариф).
// Только в проде; чтобы заработала, в Vercel-дашборде проекта должен быть
// включён тумблер Web Analytics (Settings → Analytics, бесплатно).
if (import.meta.env.PROD) inject()

// Глобальные ловушки ошибок ДО первого рендера: иначе сбой на старте
// (самый неприятный — белый экран) не попал бы никуда.
installErrorLogging()

// iOS проверяет новую версию PWA только при холодном старте — если приложение
// разворачивают из фона, оно неделями может жить на старом коде. Поэтому
// проверяем обновления и по возвращению в приложение, и раз в час.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update()
    })
    setInterval(() => void reg.update(), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
