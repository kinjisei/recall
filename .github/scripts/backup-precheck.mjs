/**
 * Предпроверка бэкапа: ловит то, что можно поймать ДО дампа.
 *
 * Зачем отдельным файлом: разбор строки подключения в YAML нельзя прогнать
 * локально — его проверяет только настоящий прогон, раз в сутки. Здесь обычный
 * модуль с тестом (`node scripts/test-backup-precheck.mjs`).
 *
 * Запуск из workflow (stdout уходит в сводку прогона):
 *   node .github/scripts/backup-precheck.mjs
 * Читает DB_URL и PASSPHRASE из окружения, код возврата 1 = дальше не идём.
 *
 * ⚠️ Ни строка подключения, ни пароль наружу не выводятся — только номер порта
 * и человеческий текст. Сводка прогона секреты не маскирует.
 */

/**
 * Разбирает строку подключения, не раскрывая её.
 * Пароль может содержать «:» и «/», поэтому логин отрезаем по ПОСЛЕДНЕЙ «@».
 * @param {string} url
 * @returns {{ user: string, host: string, port: string }}
 */
export function parseUrl(url) {
  const withoutScheme = String(url).replace(/^[a-z+]+:\/\//i, '')
  const at = withoutScheme.lastIndexOf('@')
  const auth = at === -1 ? '' : withoutScheme.slice(0, at)
  const rest = at === -1 ? withoutScheme : withoutScheme.slice(at + 1)
  const hostPort = rest.split(/[/?]/)[0]
  const colon = hostPort.lastIndexOf(':')
  const host = colon === -1 ? hostPort : hostPort.slice(0, colon)
  const portRaw = colon === -1 ? '' : hostPort.slice(colon + 1)
  return {
    user: auth.split(':')[0],
    host,
    port: /^\d+$/.test(portRaw) ? portRaw : '',
  }
}

/**
 * @param {{ url?: string, passphrase?: string }} env
 * @returns {{ ok: boolean, summary: string, reason: string }}
 */
export function precheck({ url, passphrase }) {
  const problems = []

  if (!url) {
    problems.push({
      reason: 'нет SUPABASE_DB_URL',
      md: [
        '❌ **Не задан секрет `SUPABASE_DB_URL`.**',
        '',
        'Settings → Secrets and variables → Actions → New repository secret.',
        'Значение: Supabase → Connect → **Session pooler**.',
      ],
    })
  }
  if (!passphrase) {
    problems.push({
      reason: 'нет BACKUP_PASSPHRASE',
      md: [
        '❌ **Не задан секрет `BACKUP_PASSPHRASE`.**',
        '',
        'Это пароль шифрования дампа. Придумайте длинный и сохраните вне GitHub:',
        'потеряете — резервная копия станет бесполезной.',
      ],
    })
  }

  if (url) {
    const { user, host, port } = parseUrl(url)

    if (!/^postgres(ql)?:\/\//i.test(url)) {
      problems.push({
        reason: 'не строка подключения',
        md: [
          '❌ **`SUPABASE_DB_URL` не похож на строку подключения.**',
          '',
          'Ожидается `postgresql://…`. Скопируйте её целиком в Supabase → Connect.',
        ],
      })
    } else if (!/pooler\.supabase\.com$/i.test(host)) {
      // Самая частая ошибка: взяли «Direct connection».
      problems.push({
        reason: 'не пул соединений',
        md: [
          '❌ **`SUPABASE_DB_URL` указывает не на пул соединений.**',
          '',
          'У раннеров GitHub нет IPv6, а прямой хост Supabase доступен только по нему —',
          'поэтому дамп умирает за секунды с невнятным «could not translate host name».',
          '',
          'Возьмите строку из Supabase → **Connect → Session pooler**',
          '(хост вида `...pooler.supabase.com`, порт **5432**) и обновите секрет.',
        ],
      })
    } else if (port === '6543') {
      // Вторая ошибка на том же экране: «Transaction pooler». Хост тот же самый,
      // поэтому проверка выше её пропускает.
      problems.push({
        reason: 'транзакционный пул',
        md: [
          '❌ **`SUPABASE_DB_URL` ведёт в транзакционный пул (порт 6543).**',
          '',
          '`pg_dump` держит одну сессию от начала до конца, а транзакционный пул отдаёт',
          'соединение другому клиенту между запросами — дамп обрывается на середине',
          'с сообщением про prepared statement.',
          '',
          'В Supabase → **Connect** возьмите **Session pooler**: тот же хост, порт **5432**.',
        ],
      })
    } else if (!user.includes('.')) {
      // Третья ошибка: логин от прямого подключения оставили для пула. Сервер
      // отвечает «Tenant or user not found» — по этому тексту не догадаться.
      problems.push({
        reason: 'логин не для пула',
        md: [
          '❌ **Логин в `SUPABASE_DB_URL` не для пула соединений.**',
          '',
          'Через пул пользователь пишется как `postgres.<код-проекта>`, а не просто `postgres`.',
          'Сервер на такое отвечает «Tenant or user not found» — по этому тексту причину',
          'не угадать, поэтому проверяем заранее.',
          '',
          'Скопируйте строку целиком из Supabase → Connect → **Session pooler**.',
        ],
      })
    }
  }

  if (problems.length === 0) return { ok: true, summary: '', reason: '' }
  return {
    ok: false,
    reason: problems.map((p) => p.reason).join(', '),
    summary: problems.map((p) => p.md.join('\n')).join('\n\n'),
  }
}

// --- запуск из workflow -----------------------------------------------------
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Путь целиком, а не окончание имени: тест называется похоже.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { ok, summary, reason } = precheck({
    url: process.env.DB_URL,
    passphrase: process.env.PASSPHRASE,
  })
  if (!ok) {
    process.stdout.write(summary + '\n')
    process.stderr.write(`предпроверка не прошла: ${reason}\n`)
    process.exit(1)
  }
}
