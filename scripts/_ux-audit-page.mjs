// ============================================================================
// Проверка страницы для UX-аудитов (scripts/ux-audit.mjs — экраны ученика,
// scripts/ux-audit-schedule.mjs — расписание учителя): контраст текста,
// тач-цели ≥44×44, подписи у полей и кнопок-иконок. Функция уходит в
// страницу целиком (page.evaluate) — снаружи ничего не берёт.
// ============================================================================

/**
 * Выполняется В СТРАНИЦЕ: собирает замечания по контрасту, тач-целям и подписям.
 * rootSel — проверять только внутри последнего такого элемента (открытая
 * шторка `[role="dialog"]`): экран под затемнением человек не трогает.
 */
export function auditPage(rootSel) {
  const issues = []
  const root = (rootSel && [...document.querySelectorAll(rootSel)].pop()) || document.body
  const BASE_BG = [22, 24, 38] // #161826

  // Цвет из getComputedStyle бывает не только rgb(): токены и палитра Tailwind
  // v4 — oklch()/oklab() (danger, warning). Раньше такие цвета не читались, и
  // проверка молча их пропускала (кнопка «Отменить урок» — белый на белом,
  // 1:1, нашлось в ux-audit-schedule, Ф2.7). Любой другой вид — через canvas:
  // браузер сам переводит цвет в sRGB.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const parseColor = (s) => {
    const m = s.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/)
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]]
    if (!ctx || !s || s === 'transparent') return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = s
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const blend = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3])
    if (a === 0) return [0, 0, 0, 0]
    return [
      (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a,
      (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a,
      (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a,
      a,
    ]
  }
  const lum = ([r, g, b]) => {
    const f = (c) => {
      c /= 255
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (c1, c2) => {
    const [l1, l2] = [lum(c1), lum(c2)].sort((a, b) => b - a)
    return (l1 + 0.05) / (l2 + 0.05)
  }

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (el.closest('[aria-hidden="true"]')) return false
    return true
  }

  // фон элемента: идём вверх, копим полупрозрачные слои до первого непрозрачного
  const effectiveBg = (el) => {
    const layers = []
    let node = el
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage !== 'none') return null // градиент — не посчитать честно
      const c = parseColor(cs.backgroundColor)
      if (c && c[3] > 0) {
        layers.push(c)
        if (c[3] >= 1) break
      }
      node = node.parentElement
    }
    let bg = [...BASE_BG, 1]
    for (let i = layers.length - 1; i >= 0; i--) bg = blend(layers[i], bg)
    return bg
  }

  const snippet = (el) =>
    (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) || '<без текста>'

  // ---- 1. Контраст текста ----
  const seen = new Set()
  for (const el of root.querySelectorAll('*')) {
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    )
    if (!hasText || !visible(el)) continue
    // WCAG исключает неактивные контролы из требований к контрасту
    if (el.closest(':disabled, [aria-disabled="true"]')) continue
    const cs = getComputedStyle(el)
    // суммарная прозрачность по предкам
    let op = 1
    for (let n = el; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity
    if (op < 0.5) continue // исчезающие/анимируемые
    const fgRaw = parseColor(cs.color)
    const bg = effectiveBg(el)
    if (!fgRaw || !bg) continue
    const fg = blend([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * op], bg)
    const r = ratio(fg, bg)
    const size = parseFloat(cs.fontSize)
    const weight = +cs.fontWeight || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const need = large ? 3 : 4.5
    if (r < need) {
      const key = snippet(el) + '|' + cs.color
      if (!seen.has(key)) {
        seen.add(key)
        issues.push({
          type: 'contrast',
          detail: `${r.toFixed(2)}:1 (нужно ${need}:1, ${Math.round(size)}px) — «${snippet(el)}»`,
        })
      }
    }
  }

  // ---- 2. Тач-цели ≥44×44 ----
  const targets = root.querySelectorAll(
    'a, button, input, select, textarea, [role="button"], [role="tab"]',
  )
  for (const el of targets) {
    if (!visible(el)) continue
    if (el.disabled) continue
    const r = el.getBoundingClientRect()
    if (r.width >= 44 && r.height >= 44) continue
    // исключение WCAG 2.5.5: цель в потоке текста (слово/ссылка внутри
    // предложения). display может быть inline ИЛИ inline-block — кнопка-слово
    // с вертикальным padding для хит-зоны считается inline-block. Ключевой
    // признак «в предложении»: родитель — текстовый блок, а собственный текст
    // цели много короче всего предложения. Icon-кнопку в flex-строке (родитель
    // DIV) это НЕ исключает — регрессии по-прежнему видны.
    const cs = getComputedStyle(el)
    const parentText = (el.parentElement?.textContent || '').trim()
    const ownText = (el.textContent || '').trim()
    const inFlow = cs.display === 'inline' || cs.display === 'inline-block'
    const parentIsText = ['P', 'SPAN', 'LI', 'LABEL'].includes(el.parentElement?.tagName || '')
    if (inFlow && parentIsText && parentText.length > ownText.length + 5) continue
    issues.push({
      type: 'touch',
      detail: `${Math.round(r.width)}×${Math.round(r.height)} — <${el.tagName.toLowerCase()}> «${snippet(el)}»`,
    })
  }

  // ---- 3. Подписи ----
  for (const el of root.querySelectorAll('input, textarea, select')) {
    if (!visible(el)) continue
    if (['hidden', 'submit', 'button'].includes(el.type)) continue
    const labelled =
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-labelledby') ||
      (el.labels && el.labels.length > 0)
    if (!labelled)
      issues.push({ type: 'label', detail: `поле без label/aria-label: ${el.type || el.tagName} «${el.placeholder || el.id || ''}»` })
  }
  for (const el of root.querySelectorAll('button, a, [role="button"]')) {
    if (!visible(el)) continue
    const hasText = (el.textContent || '').trim().length > 0
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title
    if (!hasText && !labelled)
      issues.push({ type: 'label', detail: `кнопка-иконка без aria-label: <${el.tagName.toLowerCase()} class="${(el.className || '').toString().slice(0, 50)}">` })
  }

  return issues
}
