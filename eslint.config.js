// Линтер — сторож стиля кода (PLAN.md Ф1.1, архитектура §10).
//
// Старые нарушения записаны в scripts/checks/baseline/eslint.json («к
// исправлению») и не мешают работать; новые не проходят. Как с этим жить —
// scripts/checks/README.md.
//
// ⚠️ У правил нет уровня «предупреждение» — только ошибки. Предупреждение, которое
// можно пропустить, пропускают: оно не блокирует коммит и не попадает в список
// подавлений (ESLint подавляет только ошибки). Поэтому ниже каждое «warn»
// поднимается до «error». Единственное оставшееся предупреждение — «лишний
// eslint-disable» (его подавить нельзя, а ошибкой он заблокировал бы старый код).
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const config = defineConfig([
  globalIgnores([
    'dist/**',
    'dev-dist/**',
    'twa/**',
    // прототип экрана от дизайна, не входит в сборку
    'handoff/**',
    // генерируется из схемы базы (PLAN.md Ф1.2)
    'src/lib/database.types.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['api/**', 'vite.config.ts', 'eslint.config.js', '.github/scripts/**', 'docs/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // смоуки выполняют куски кода внутри страницы (page.evaluate) — там
    // живут document и window
    files: ['scripts/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
])

// объекты правил у готовых наборов заморожены — собираем новые
const strict = (level) => (level === 'warn' || level === 1 ? 'error' : level)
const strictRules = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([name, value]) => [
      name,
      Array.isArray(value) ? [strict(value[0]), ...value.slice(1)] : strict(value),
    ]),
  )

export default config.map((block) => (block.rules ? { ...block, rules: strictRules(block.rules) } : block))
