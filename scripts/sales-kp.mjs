// ============================================================================
// Коммерческое предложение для репетиторов: docs/sales/kp.html → PDF под экран
// телефона (390 × 844, страница = экран) — docs/sales/recall-kp.pdf.
//
// Цены, места и число AI-материалов берутся из каталога тарифов
// (src/domains/billing/model.ts), ссылки связи — из src/shared/lib/contacts.ts:
// своя копия цен в КП разошлась бы с «Тарифами» при первой правке. Сборка
// падает, если шрифт Rubik не загрузился (нужна сеть: Google Fonts), если
// текст не влез в страницу или если в PDF не столько страниц, сколько в HTML.
//
//   node scripts/sales-kp.mjs               собрать PDF
//   node scripts/sales-kp.mjs --shots <dir> ещё и PNG каждой страницы — сверить глазами
// ============================================================================
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import puppeteer from 'puppeteer-core'
import { PLANS } from '../src/domains/billing/model.ts'
import { supportMailto, supportTelegram, supportWhatsapp } from '../src/shared/lib/contacts.ts'
import { profileDir } from './_profile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'docs/sales/kp.html')
const OUT = join(ROOT, 'docs/sales/recall-kp.pdf')
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
/** Звоним со старым адресом, домен — потом (журнал п.20). */
const START_URL = 'https://recall-pgkz.vercel.app/teachers'
const W = 390
const H = 844

const shotsAt = process.argv.indexOf('--shots')
const shotsDir = shotsAt > 0 ? resolve(process.argv[shotsAt + 1] ?? 'kp-shots') : null

/** Что подставить в HTML: по id тарифа — цена, ₸ в день, места, материалы. */
function planData() {
  const money = (n) => `${n.toLocaleString('ru-RU').replace(/\s/g, '\u00a0')}\u00a0₸`
  const out = {}
  for (const p of PLANS) {
    if (p.studentLimit === undefined) continue
    const m = p.features.join(' ').match(/около (\d+) материалов/)
    if (!m) throw new Error(`${p.id}: в описании тарифа нет «около N материалов» — поправь регулярку или текст КП`)
    out[p.id] = { price: money(p.price), perDay: money(Math.round(p.price / 30)), limit: String(p.studentLimit), materials: m[1] }
  }
  return out
}

const links = {
  start: START_URL,
  whatsapp: supportWhatsapp(),
  telegram: supportTelegram(),
  email: supportMailto('Recall — вопрос репетитора'),
}

async function main() {
  const plans = planData()
  // порт свой на каждый запуск: иначе connect прицепится к чужому Edge
  const PORT = 9400 + (Date.now() % 500)
  spawn(EDGE, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir('recall-kp')}`, '--no-first-run', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref()

  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: W, height: H })
    await page.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle0', timeout: 30000 })

    const problems = await page.evaluate(async ({ plans, links, H }) => {
      const errs = []
      const fill = (attr, key) => {
        for (const el of document.querySelectorAll(`[${attr}]`)) {
          const v = plans[el.getAttribute(attr)]?.[key]
          if (v === undefined) errs.push(`${attr}="${el.getAttribute(attr)}" — нет такого тарифа репетитора`)
          else el.textContent = v
        }
      }
      fill('data-plan', 'price')
      fill('data-per-day', 'perDay')
      fill('data-limit', 'limit')
      fill('data-materials', 'materials')
      for (const a of document.querySelectorAll('[data-link]')) {
        const href = links[a.getAttribute('data-link')]
        if (!href) errs.push(`data-link="${a.getAttribute('data-link')}" — нет такой ссылки`)
        else a.setAttribute('href', href)
      }
      await document.fonts.ready
      if (!document.fonts.check('600 16px Rubik')) errs.push('шрифт Rubik не загрузился — нужна сеть (Google Fonts)')
      document.querySelectorAll('.page').forEach((p, i) => {
        if (p.scrollHeight > p.clientHeight) errs.push(`страница ${i + 1}: текст не влез — на ${p.scrollHeight - p.clientHeight} px`)
        if (p.clientHeight !== H) errs.push(`страница ${i + 1}: высота ${p.clientHeight}, а нужна ${H}`)
      })
      return { errs, pages: document.querySelectorAll('.page').length }
    }, { plans, links, H })
    // снимки — до проверки: при «не влезло» по ним видно, что ужимать
    if (shotsDir) {
      mkdirSync(shotsDir, { recursive: true })
      for (let i = 0; i < problems.pages; i++) {
        await page.screenshot({ path: join(shotsDir, `kp-${i + 1}.png`), clip: { x: 0, y: i * H, width: W, height: H } })
      }
    }
    if (problems.errs.length) throw new Error('КП не собрано:\n- ' + problems.errs.join('\n- '))

    const pdf = await page.pdf({ width: `${W}px`, height: `${H}px`, printBackground: true, preferCSSPageSize: true })
    writeFileSync(OUT, pdf)
    // страницы в PDF — объекты «/Type /Page» (не «/Pages»)
    const pdfPages = (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length
    if (pdfPages !== problems.pages) throw new Error(`в PDF ${pdfPages} стр., а в HTML ${problems.pages} — что-то перенеслось`)
    console.log(`✔ ${OUT} — ${pdfPages} стр., ${(pdf.length / 1024).toFixed(0)} КБ`)
    if (shotsDir) console.log(`  снимки страниц: ${shotsDir}`)
  } finally {
    await browser.close().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
