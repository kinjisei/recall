/**
 * «Выгрузить мои данные» без базы (domains/account/model.ts, PLAN.md
 * Ф2.17-4г-2б): части по порядку и с подписями, неизвестная часть не теряется,
 * имя файла — день по Алматы, и пара «список частей ↔ export_my_data» в
 * последней миграции, где функция определена.
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-account-export.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EXPORT_PARTS, exportFile } from '../src/domains/account/model.ts'

let ok = 0
let failed = 0
const check = (name, pass, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${pass || !detail ? '' : ` — ${detail}`}`)
  if (pass) ok++
  else failed++
}

// ── пара с базой: ключи jsonb_build_object в export_my_data ─────────────────────
const dir = join(import.meta.dirname, '../supabase/migrations')
const withFn = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) => /function public\.export_my_data\(/.test(readFileSync(join(dir, f), 'utf8')))
const sqlText = withFn.length ? readFileSync(join(dir, withFn.at(-1)), 'utf8') : ''
const body = sqlText.slice(sqlText.indexOf('function public.export_my_data('), sqlText.indexOf('end $fn$', sqlText.indexOf('function public.export_my_data(')))
const sqlKeys = [...body.matchAll(/^\s*'([a-z_]+)',\s*\(select/gm)].map((m) => m[1])
const ours = EXPORT_PARTS.map((p) => p.key)
check('функция export_my_data найдена в миграциях', sqlKeys.length > 10, `${withFn.at(-1) ?? 'нет'}: ${sqlKeys.length} частей`)
const missing = sqlKeys.filter((k) => k !== 'profile' && !ours.includes(k))
const extra = ours.filter((k) => !sqlKeys.includes(k))
check('каждая часть базы подписана в EXPORT_PARTS', missing.length === 0, missing.join(', '))
check('в EXPORT_PARTS нет частей, которых база не отдаёт', extra.length === 0, extra.join(', '))
check('подписи не пустые и не повторяются', EXPORT_PARTS.every((p) => p.what.trim()) && new Set(ours).size === ours.length)

// ── файл ─────────────────────────────────────────────────────────────────────────
// 20:30 UTC 21-го — в Алматы уже 22-е: имя файла по Алматы
const now = new Date('2026-10-21T20:30:00Z')
const data = { profile: { id: 'u1' }, cards: [{ id: 'c1' }], activity_log: [{ day: '2026-10-21' }], lessons: null, brand_new_part: [{ x: 1 }] }
const { name, text } = exportFile(data, 'a@b.kz', now)
const file = JSON.parse(text)
const keys = Object.keys(file.parts)
check('имя файла — день по Алматы', name === 'recall-2026-10-22.json', name)
check('части — в порядке EXPORT_PARTS, профиль отдельно', keys.slice(0, ours.length).join() === ours.join() && file.profile?.id === 'u1' && !('profile' in file.parts))
check('у части подпись и строки', file.parts.cards.what === 'слова' && file.parts.cards.rows.length === 1)
check('нет части в ответе или не массив — пустые строки, а не null', file.parts.writing_tasks.rows.length === 0 && Array.isArray(file.parts.lessons.rows))
check('неизвестная часть не теряется — в конце, без подписи', keys.at(-1) === 'brand_new_part' && file.parts.brand_new_part.rows.length === 1 && file.parts.brand_new_part.what === '')
check('в файле почта и время выгрузки', file.account.email === 'a@b.kz' && file.exported_at === now.toISOString() && /22/.test(file.about))

console.log(`\n${ok} ✓  ${failed} ✗`)
process.exit(failed ? 1 : 0)
