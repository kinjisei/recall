/**
 * Проверка функций api/ ТАК ЖЕ, как их собирает Vercel.
 *
 * Зачем. `npm run build` проверяет api/ по tsconfig.node.json со `strict: true`
 * и всегда зелёный. Vercel же читает КОРНЕВОЙ tsconfig.json, и пока в нём не
 * было compilerOptions, функции компилировались со `strictNullChecks: false`.
 * В этом режиме TypeScript не сужает размеченные объединения — обычное
 * `if (!access.ok) return res.status(access.status)` превращается в
 * «Property 'status' does not exist on type AuthResult». Сборка на Vercel
 * падала, локальная оставалась зелёной, и узнать об этом можно было только из
 * писем о неудачном деплое.
 *
 * Здесь мы намеренно компилируем api/ в САМОМ СЛАБОМ режиме: если код зависит
 * от строгих флагов, это видно сразу и локально. Строгую проверку никто не
 * отменял — она в `npm run build`; эта дополняет её снизу.
 *
 * Запуск: node scripts/check-api-vercel.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = mkdtempSync(join(tmpdir(), 'api-check-'))
const cfg = join(dir, 'tsconfig.json')

writeFileSync(
  cfg,
  JSON.stringify(
    {
      compilerOptions: {
        // Ровно то, что получается у Vercel без наших настроек: модульная
        // система как в Node, и НИ ОДНОГО строгого флага.
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        strict: false,
        strictNullChecks: false,
      },
      include: [join(ROOT, 'api', '**', '*.ts').replace(/\\/g, '/')],
    },
    null,
    2,
  ),
)

// Зовём сам tsc, а не npx через оболочку: с shell:true Node предупреждает про
// несэкранированные аргументы, а путь у нас во временной папке.
const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')

let out = ''
let failed = false
try {
  out = execFileSync(process.execPath, [tsc, '-p', cfg], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (e) {
  failed = true
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`
}
rmSync(dir, { recursive: true, force: true })

if (failed) {
  console.log('✗ api/ не собирается так, как это делает Vercel:\n')
  console.log(out.trim())
  console.log(
    '\nЧаще всего причина — сужение типа, которое работает только со strictNullChecks.',
    '\nЛечится явным предикатом (пример: authDenied в api/_auth.ts), а не приведением типа.',
  )
  process.exit(1)
}

console.log('✓ api/ собирается и в слабом режиме — Vercel не упадёт на строгости типов')
