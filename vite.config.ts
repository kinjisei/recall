import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handle as geminiHandle } from './api/gemini'
import { handle as transcribeHandle } from './api/transcribe'
import { buildEnvProblems } from './scripts/_keys.mjs'
import { RUNTIME_CHUNKS_MAX, startupPrecache } from './scripts/_precache.mjs'

/** Что серверные функции читают из окружения (process.env) — в dev берём из .env.local. */
const SERVER_ENV = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown

/**
 * Серверная функция из api/ как обработчик dev-сервера — ТОТ ЖЕ код, что
 * отвечает на проде, без Vercel CLI.
 *
 * Раньше здесь жила вторая копия роутинга AI — без входа, прав и лимитов:
 * локально ученик получал учительскую задачу, в которой прод ему отказывает,
 * а правка порядка моделей в одном месте не доезжала до другого (архитектура
 * §7). Адаптер только делает из запроса Node то, что Vercel даёт функции:
 * разобранное тело и методы status/json/send/redirect.
 *
 * ⚠️ Раз код тот же, то и база та же, что у клиента: `npm run dev` списывает
 * энергию на ЖИВОЙ базе, `npm run dev:test` — на тестовой.
 */
function vercelRoute(path: string, handler: ApiHandler, needs: string): Plugin {
  return {
    name: `vercel-route:${path}`,
    configureServer(server) {
      server.middlewares.use(path, (req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const raw = Buffer.concat(chunks).toString()
          let body: unknown
          try {
            body = raw ? JSON.parse(raw) : undefined
          } catch {
            res.statusCode = 400 // как Vercel на кривой JSON
            res.end('Invalid JSON')
            return
          }
          const vreq: VercelRequest = Object.assign(req, { body, query: {}, cookies: {} })
          const vres: VercelResponse = Object.assign(res, {
            status(code: number) {
              res.statusCode = code
              return vres
            },
            json(value: unknown) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(value))
              return vres
            },
            send(value: unknown) {
              res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
              return vres
            },
            redirect(statusOrUrl: string | number, url?: string) {
              res.statusCode = typeof statusOrUrl === 'number' ? statusOrUrl : 307
              res.setHeader('Location', url ?? String(statusOrUrl))
              res.end()
              return vres
            },
          })
          Promise.resolve(handler(vreq, vres)).catch((e: unknown) => {
            server.config.logger.error(`${path}: ${e instanceof Error ? e.stack : String(e)}`)
            if (!res.headersSent) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Сбой обработчика в dev — смотри терминал.' }))
            } else res.destroy()
          })
        })
      })
      if (!process.env[needs]) server.config.logger.warn(`${needs} нет в .env.local — ${path} в dev не ответит`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Читаем .env.local целиком (третий аргумент '' = без фильтра по префиксу).
  // В клиентский код всё равно попадают только переменные с префиксом VITE_.
  const env = loadEnv(mode, process.cwd(), '')
  // Ключи Supabase (scripts/_keys.mjs): секрет в VITE_ или старый ключ — стоп
  // всегда; на Vercel ещё и без ключа, чтобы в проде осталась прежняя версия.
  const keyProblems = buildEnvProblems(env, { onVercel: Boolean(process.env.VERCEL) })
  if (keyProblems.length) throw new Error(`Ключи Supabase:\n  ${keyProblems.join('\n  ')}`)
  // Серверным функциям — то, что им даёт Vercel. Уже заданное в окружении не
  // трогаем: dev:test подменяет адрес базы на тестовую именно так.
  for (const key of SERVER_ENV) if (process.env[key] === undefined && env[key]) process.env[key] = env[key]
  const precache = startupPrecache()

  return {
    plugins: [
      react(),
      tailwindcss(),
      vercelRoute('/api/gemini', geminiHandle, 'GEMINI_API_KEY'),
      vercelRoute('/api/transcribe', transcribeHandle, 'GROQ_API_KEY'),
      precache.collect,
      VitePWA({
        registerType: 'autoUpdate',
        // регистрируем SW сами в main.tsx (проверка обновлений при возврате в приложение)
        injectRegister: false,
        workbox: {
          // Новая версия включается сразу, а не после закрытия всех окон
          // (решение владельца, журнал п.58, Ф1.12): скачалась — включилась,
          // и registerSW (main.tsx) перезагружает страницу. Плагин ставит эти
          // флаги сам только при injectRegister 'auto' — у нас false, поэтому
          // явно; без них свёрнутое приложение сутками жило на старом коде.
          // Цена: перезагрузка стирает набранный, но не отправленный текст.
          skipWaiting: true,
          clientsClaim: true,
          // не отдавать /api/* из офлайн-кэша SPA (иначе прокси ломается офлайн)
          navigateFallbackDenylist: [/^\/api\//],
          // Офлайн-кэш (precache) = стили, шрифты, картинки и СТАРТОВЫЙ ГРАФ:
          // стартовый файл и всё, что он импортирует статически, рекурсивно
          // (+ workbox-window для регистрации SW) — scripts/_precache.mjs.
          // Граф берётся из метаданных сборки, а не масками имён: маски
          // отставали от того, как Rolldown режет чанки, и 12 стартовых файлов
          // (react-dom, клиент базы, роутер…) не попадали в кэш — новая версия,
          // скачанная в фоне, открывалась без сети белым экраном (Ф1.11).
          // Остальные чанки (испанский словарь ~1.3 МБ, грамматика, экраны) —
          // не нужны каждому, докачиваются при первом открытии (runtime ниже).
          // Сборка падает, если хоть один файл графа не в precache (verify).
          globPatterns: ['**/*.{css,html,ico,svg,png,webmanifest,woff2}', 'assets/*.js'],
          manifestTransforms: [precache.transform],
          runtimeCaching: [
            {
              // остальные чанки — кэшируются после первого открытия раздела;
              // предел — чтобы файлы прошлых сборок не копились (Ф1.12)
              urlPattern: /\/assets\/.*\.js$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'recall-chunks',
                expiration: { maxEntries: RUNTIME_CHUNKS_MAX, purgeOnQuotaError: true },
              },
            },
          ],
        },
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Recall — английский',
          short_name: 'Recall',
          lang: 'ru',
          description: 'Учим и поддерживаем английский язык',
          theme_color: '#161826',
          background_color: '#161826',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
      precache.verify,
    ],
  }
})
