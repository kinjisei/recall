/**
 * Импорт api/*.ts из скриптов — одно место (было скопировано в каждый тест).
 *
 * api/ импортирует соседей с расширением .js (так требует Vercel в ESM), а Node
 * со срезом типов ищет файл буквально — подставляем .ts.
 *
 * ⚠️ Подключать первой строкой (`import './_api-loader.mjs'`), а сами api/*.ts
 * брать ДИНАМИЧЕСКИ — `await import('../api/…')`. Статические импорты
 * разрешаются раньше, чем выполнится этот файл, и хук их не увидит.
 */
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (e) {
      if (specifier.startsWith('.') && specifier.endsWith('.js')) {
        return nextResolve(specifier.slice(0, -3) + '.ts', context)
      }
      throw e
    }
  },
})
