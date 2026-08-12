// ============================================================================
// Профиль браузера для смоуков — с уборкой за собой.
//
// Каждый скрипт поднимает свой Edge с одноразовым --user-data-dir. Раньше эта
// папка оставалась навсегда: за один рабочий день накопилось 74 профиля, диск
// заполнился, и три проверки подряд упали «по разным причинам» — на самом деле
// браузеру просто некуда было писать. Ложное падение проверки дороже самой
// проверки: по нему начинают чинить работающий код.
//
// Уборка трёхслойная, потому что на Windows папку живого браузера удалить
// нельзя (EBUSY) — свой же профиль на выходе не всегда поддаётся:
//   1) на выходе процесса — свой профиль;
//   2) при следующем запуске — остатки, чей процесс-хозяин уже мёртв (pid
//      записан в имени папки);
//   3) и просто всё старше трёх часов — на случай, если pid успели переиспользовать.
// Параллельный прогон не заденем: его процесс жив, а папка молодая.
// ============================================================================
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(tmpdir(), 'recall-profiles')
const STALE_MS = 3 * 60 * 60 * 1000

function alive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0) // сигнал 0 ничего не делает, только проверяет наличие
    return true
  } catch {
    return false // ESRCH — процесса нет; EPERM — есть, но чужой
  }
}

function sweepStale() {
  let entries = []
  try {
    entries = readdirSync(ROOT)
  } catch {
    return // папки ещё нет — убирать нечего
  }
  const now = Date.now()
  for (const entry of entries) {
    const dir = join(ROOT, entry)
    const pid = Number(entry.split('-').at(-2))
    try {
      if (alive(pid) && now - statSync(dir).mtimeMs < STALE_MS) continue
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // занято или уже удалено — заберёт следующий прогон
    }
  }
}

/**
 * Готовит одноразовую папку профиля и вешает удаление на выход процесса.
 * @param {string} name короткое имя скрипта, попадёт в путь
 * @returns {string} абсолютный путь для --user-data-dir
 */
export function profileDir(name) {
  sweepStale()
  const dir = join(ROOT, `${name}-${process.pid}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  process.on('exit', () => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // браузер ещё держит файлы — подметёт sweepStale в следующий раз
    }
  })
  return dir
}
