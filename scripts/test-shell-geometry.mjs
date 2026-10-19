/**
 * Геометрия каркаса по правилам d0 (PLAN.md Ф2.17-1, журнал п.55):
 * src/shared/lib/shellGeometry.ts.
 *
 * Числа — с самих макетов, а не придуманные: d0-1 (1280 → содержимое 976,
 * 1440 → 1120), d0-4 (окно 720 рядом с Google Meet → 600, окно 960 → 840),
 * d2 (1440: панель «Новый урок» сдвигает неделю), d3-4 (1440: «Отметить
 * оплату» ложится поверх «списка + подробностей»). Разойдётся формула полей
 * или порог сдвига — тест краснеет на конкретном кадре.
 *
 * Запуск: node scripts/test-shell-geometry.mjs
 */
import { areaPad, contentOf, menuWidth, panelPushes, shellMode } from '../src/shared/lib/shellGeometry.ts'
import { AREA, COLUMN_NEED } from '../src/shared/ui/breakpoints.ts'

let ok = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) ok++
  else failed++
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
/** Содержимое при окне `w` и меню этого окна. */
const contentAt = (w, collapsed = false) => {
  const mode = shellMode(w >= 720, w >= 1280, collapsed)
  return contentOf(w - menuWidth(mode))
}

// ── меню по ширине окна (правило 1) ──
check('390 — телефонное меню', shellMode(false, false, false) === 'phone')
check('720 — рельс 72', shellMode(true, false, false) === 'rail' && menuWidth('rail') === 72)
check('1279 — всё ещё рельс', shellMode(1279 >= 720, 1279 >= 1280, false) === 'rail')
check('1280 — меню 240', shellMode(true, true, false) === 'menu' && menuWidth('menu') === 240)
check('1280, свёрнуто руками — рельс', shellMode(true, true, true) === 'rail')
check('свернуть можно только от 1280: на 1000 «свёрнуто» ничего не меняет', shellMode(true, false, true) === 'rail')
check('уже 720 «свёрнуто» не включает рельс', shellMode(false, false, true) === 'phone')

// ── поля области (правило 2) ──
check('поле 24 при области < 1040', areaPad(1039) === 24 && areaPad(648) === 24)
check('поле 32 при 1040–1199', areaPad(1040) === 32 && areaPad(1199) === 32)
check('поле 40 от 1200', areaPad(1200) === 40 && areaPad(1680) === 40)

// ── содержимое на кадрах d0 ──
check('d0-1: 1280 → содержимое 976', contentAt(1280) === 976, String(contentAt(1280)))
check('d0-1: 1440 → содержимое 1120', contentAt(1440) === 1120, String(contentAt(1440)))
check('d0-4: окно 720 → содержимое 600', contentAt(720) === 600, String(contentAt(720)))
check('d0-4: окно 960 → содержимое 840', contentAt(960) === 840, String(contentAt(960)))

// ── пороги раскладок на тех же кадрах (правило 7) ──
check('d0-4: 720 — неделя списком (600 < 700)', contentAt(720) < AREA.week)
check('d0-4: 960 — неделя колонками, «список + подробности» по очереди, Главная одной колонкой',
  contentAt(960) >= AREA.week && contentAt(960) < AREA.split && contentAt(960) < AREA.homeSplit)
check('1280 — Главная с правой колонкой (976 ≥ 936)', contentAt(1280) >= AREA.homeSplit)
check('1440 — поля упражнения (1120 ≥ 1120)', contentAt(1440) >= AREA.exerciseSides)
check('1280 — без полей упражнения', contentAt(1280) < AREA.exerciseSides)

// ── правая панель: сдвиг или поверх (правило 8) ──
check('d2: 1440 — «Новый урок» сдвигает неделю', panelPushes(1440 - 240, AREA.week))
check('d3-4: 1440 — «Отметить оплату» поверх списка + подробностей', !panelPushes(1440 - 240, AREA.split))
check('1280 — неделе после сдвига мало места: поверх', !panelPushes(1280 - 240, AREA.week))
check('1440 — колонку старого экрана панель сдвигает', panelPushes(1440 - 240, COLUMN_NEED))
check('1280 — колонку старого экрана сдвигает (остаётся ровно 600)', panelPushes(1280 - 240, COLUMN_NEED))
check('1100 — колонку старого экрана: поверх (1028 − 440 = 588 < 600)', !panelPushes(1100 - 72, COLUMN_NEED))
check('1920 — даже «список + подробности» сдвигаются', panelPushes(1920 - 240, AREA.split))
check('720 — всегда поверх', !panelPushes(720 - 72, COLUMN_NEED))

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
