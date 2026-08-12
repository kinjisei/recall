/**
 * Аварийная уборка за смоуками: гасит все браузеры, поднятые проверками, и
 * удаляет их профили.
 *
 * Зачем. Смоуки поднимают Edge с `--headless=new`, а он создаёт НАСТОЯЩЕЕ окно —
 * невидимое, но Windows показывает его в Alt+Tab. Пока прогон идёт, это одно
 * окно; но если скрипт умер, не закрыв браузер, окно остаётся навсегда. Так у
 * владельца накопилось два десятка одинаковых «Recall — английский», которые
 * нельзя было закрыть: за ними нет ничего, что можно нажать.
 *
 * Штатно за собой убирает сам `_profile.mjs` (в том числе при падении скрипта).
 * Этот файл — на случай, когда что-то пережило и это: перезагрузка среды,
 * убитый по Ctrl+C прогон, старые остатки.
 *
 * Запуск: node scripts/clean-smoke-browsers.mjs
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(tmpdir(), 'recall-profiles')

if (process.platform !== 'win32') {
  console.log('Скрипт для Windows: на других системах смоуки браузер не бросают.')
  process.exit(0)
}

// 1. Сколько таких браузеров сейчас живёт
const count = () => {
  try {
    const out = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ` +
          `Where-Object { $_.CommandLine -like '*recall-profiles*' } | Measure-Object).Count`,
      ],
      { encoding: 'utf8' },
    )
    return Number(out.trim()) || 0
  } catch {
    return 0
  }
}

const before = count()
console.log(`Браузеров от проверок: ${before}`)

if (before > 0) {
  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | ` +
          `Where-Object { $_.CommandLine -like '*recall-profiles*' } | ` +
          `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore', timeout: 20000 },
    )
  } catch {
    console.log('Не удалось погасить часть процессов — возможно, не хватило прав.')
  }
}

// 2. Профили: те, что освободились, удаляем
let dirs = []
try {
  dirs = readdirSync(ROOT)
} catch {
  dirs = []
}
let removed = 0
for (const entry of dirs) {
  try {
    rmSync(join(ROOT, entry), { recursive: true, force: true })
    removed++
  } catch {
    /* ещё занят — заберёт следующий прогон */
  }
}

const after = count()
console.log(`Погашено браузеров: ${before - after}`)
console.log(`Удалено папок профилей: ${removed}`)
console.log(
  after === 0
    ? 'Чисто: окон «Recall» от проверок в Alt+Tab не осталось.'
    : `Осталось процессов: ${after} — запустите ещё раз через полминуты.`,
)
