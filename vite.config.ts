import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ALLOWED_MODELS, callGemini, DEFAULT_GEMINI_MODEL } from './api/_core'
import { transcribeWithGroq } from './api/_stt'
import { groqChat } from './api/_groq'
import type { ChatTurn } from './src/types'

/**
 * Dev-эндпоинт /api/gemini: в проде этот путь обслуживает Vercel-функция
 * (api/gemini.ts), а при `npm run dev` — этот плагин, чтобы не ставить Vercel CLI.
 * Ключ берётся из .env.local: строка GEMINI_API_KEY=... (БЕЗ префикса VITE_,
 * поэтому в клиентский бандл он не попадает).
 */
function geminiDevEndpoint(
  apiKey: string | undefined,
  model: string,
  groqKey: string | undefined,
): Plugin {
  return {
    name: 'gemini-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/gemini', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Только POST' }))
          return
        }
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          void (async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              const { messages, system, model: reqModel, provider } = JSON.parse(raw || '{}') as {
                messages?: ChatTurn[]
                system?: string
                model?: string
                provider?: string
              }
              if (!Array.isArray(messages) || messages.length === 0) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Нужно поле messages (непустой массив)' }))
                return
              }
              // лёгкие задачи — на Groq (как в проде)
              if (provider === 'groq') {
                if (!groqKey) throw new Error('GROQ_API_KEY не задан в .env.local')
                const text = await groqChat(messages, system, groqKey)
                res.end(JSON.stringify({ text }))
                return
              }
              if (!apiKey) {
                throw new Error(
                  'GEMINI_API_KEY не задан: добавь строку GEMINI_API_KEY=... в .env.local и перезапусти npm run dev',
                )
              }
              const chosen =
                reqModel && ALLOWED_MODELS.includes(reqModel) ? reqModel : model
              const text = await callGemini(messages, system, apiKey, chosen)
              res.end(JSON.stringify({ text }))
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Ошибка AI'
              res.statusCode = msg.includes('лимит') ? 429 : 500
              res.end(JSON.stringify({ error: msg }))
            }
          })()
        })
      })
    },
  }
}

/**
 * Dev-эндпоинт /api/transcribe: в проде обслуживает Vercel-функция
 * (api/transcribe.ts), а при `npm run dev` — этот плагин. Ключ — из .env.local:
 * строка GROQ_API_KEY=... (БЕЗ префикса VITE_, в клиентский бандл не попадает).
 */
function transcribeDevEndpoint(apiKey: string | undefined): Plugin {
  return {
    name: 'transcribe-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Только POST' }))
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk as Buffer))
        req.on('end', () => {
          void (async () => {
            res.setHeader('Content-Type', 'application/json')
            try {
              if (!apiKey) {
                throw new Error(
                  'GROQ_API_KEY не задан: добавь строку GROQ_API_KEY=... в .env.local и перезапусти npm run dev',
                )
              }
              const { audio, mime, lang } = JSON.parse(Buffer.concat(chunks).toString() || '{}') as {
                audio?: string
                mime?: string
                lang?: string
              }
              if (typeof audio !== 'string' || !audio) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Нужно поле audio (base64)' }))
                return
              }
              const buf = Buffer.from(audio, 'base64')
              const text = await transcribeWithGroq(
                buf,
                mime || 'audio/webm',
                lang === 'es' ? 'es' : 'en',
                apiKey,
              )
              res.end(JSON.stringify({ text }))
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Ошибка распознавания'
              res.statusCode = msg.includes('лимит') ? 429 : 500
              res.end(JSON.stringify({ error: msg }))
            }
          })()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Читаем .env.local целиком (третий аргумент '' = без фильтра по префиксу).
  // В клиентский код всё равно попадают только переменные с префиксом VITE_.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      geminiDevEndpoint(env.GEMINI_API_KEY, env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, env.GROQ_API_KEY),
      transcribeDevEndpoint(env.GROQ_API_KEY),
      VitePWA({
        registerType: 'autoUpdate',
        // регистрируем SW сами в main.tsx (проверка обновлений при возврате в приложение)
        injectRegister: false,
        // не отдавать /api/* из офлайн-кэша SPA (иначе прокси ломается офлайн)
        workbox: {
          // не отдавать /api/* из офлайн-кэша SPA (иначе прокси ломается офлайн)
          navigateFallbackDenylist: [/^\/api\//],
          // По умолчанию в precache попадали ВСЕ чанки — 2.39 МБ, включая
          // ~1.3 МБ испанских данных, которые не нужны учащему английский.
          // Шрифты при этом не попадали вовсе, и офлайн интерфейс падал на
          // системный. Кладём каркас и шрифты; языковые данные докачиваются
          // по факту обращения (runtime-кэш ниже).
          // Каркас в текущей сборке (Vite 8/Rolldown) — три чанка:
          //   index-*.js          — стартовый бандл приложения;
          //   icons-*.js          — общий чанк (иконки + КЛИЕНТ SUPABASE —
          //                         без него auth-гейт не пройти, офлайн-старт
          //                         зависал бы на пустом экране);
          //   workbox-window*.js  — регистрация SW из main.tsx.
          // Прежние glob'ы jsx-runtime-*.js / supabase-*.js были мёртвыми:
          // Rolldown такие чанки больше не выделяет (2 warning'а при сборке).
          globPatterns: [
            '**/*.{css,html,ico,svg,png,webmanifest,woff2}',
            'assets/index-*.js',
            'assets/icons-*.js',
            'assets/workbox-window*.js',
          ],
          runtimeCaching: [
            {
              // остальные чанки (испанский словарь, грамматика, игры) —
              // кэшируются после первого реального открытия раздела
              urlPattern: /\/assets\/.*\.js$/,
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'recall-chunks' },
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
    ],
  }
})
