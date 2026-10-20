/**
 * Пара «кадр макета | свой снимок» в одну картинку для приёмки владельцем
 * (PLAN.md Ф2.17-4): слева кадр, вырезанный из доски `shots-mockup-frames`,
 * справа снимок экрана той же ширины, между ними — малиновая полоса.
 *
 * Где кадр на доске: левый край — 24 px у первого кадра ряда, у следующего
 * + ширина кадра + 40 (1280 → 1344, 1440 → 1504, телефон 390 → 454); верх
 * скрипт находит сам — первая строка под подписью, где столбец посередине
 * кадра перестаёт быть белым фоном доски (`--top` — задать руками).
 * Высота — как у кадра: 844 телефон, 800 на 1280, 900 на 1440; кадр «во всю
 * высоту» — своя (d10-2 — 1160; снимок тогда — `shots-screens` с `tall`).
 *
 * Запуск: node scripts/shots-pairs.mjs <доска.png> <слева> <ширина> <высота>
 *   <снимок.png> <пара.png> [--top <y>]
 * Пример: node scripts/shots-pairs.mjs mock/d10-student-card-03.png 24 1280 800
 *   shots-f2174b2/students-words-twilight-light-1280.png
 *   shots-f2174b2/compare/d10-3-words-1280-light.png
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const topAt = args.indexOf('--top')
const top = topAt >= 0 ? Number(args.splice(topAt, 2)[1]) : null
const [mock, leftS, wS, hS, shot, out] = args
if (!out) {
  console.error('Запуск: node scripts/shots-pairs.mjs <доска.png> <слева> <ширина> <высота> <снимок.png> <пара.png> [--top <y>]')
  process.exit(1)
}
const [left, w, h] = [leftS, wS, hS].map(Number)

/** Верх кадра: первая строка, где столбец x перестаёт быть белым фоном доски после подписи. */
async function frameTop(file, x, from = 60) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const px = (y) => {
    const i = (y * info.width + x) * info.channels
    return data[i] + data[i + 1] + data[i + 2]
  }
  for (let y = from; y < info.height - 1; y++) if (px(y - 1) === 765 && px(y) < 740 && px(y + 1) < 760) return y
  return null
}

const t = top ?? (await frameTop(mock, left + Math.round(w / 2)))
if (t === null) {
  console.error('Верх кадра не нашёлся — задай --top')
  process.exit(1)
}
const meta = await sharp(mock).metadata()
const hh = Math.min(h, meta.height - t)
const a = await sharp(mock).extract({ left, top: t, width: w, height: hh }).toBuffer()
const b = await sharp(shot).resize({ width: w }).toBuffer()
const bh = (await sharp(b).metadata()).height
mkdirSync(dirname(out), { recursive: true })
await sharp({ create: { width: w * 2 + 24, height: Math.max(hh, bh), channels: 3, background: '#ff00ff' } })
  .composite([
    { input: a, left: 0, top: 0 },
    { input: b, left: w + 24, top: 0 },
  ])
  .png()
  .toFile(out)
console.log(`${out} — верх кадра ${t}`)
