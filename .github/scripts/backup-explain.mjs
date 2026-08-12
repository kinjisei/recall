/**
 * Расшифровка падения бэкапа для сводки прогона.
 *
 * Зачем отдельным файлом, а не десятью строками в backup.yml: YAML в GitHub
 * Actions нельзя прогнать локально — его проверяет только сам прогон, раз в
 * сутки. Здесь же обычный модуль, к которому есть тест
 * (`node scripts/test-backup-explain.mjs`), и правило «проверка должна уметь
 * краснеть» продолжает действовать и на инфраструктуру.
 *
 * Запуск из workflow:
 *   node .github/scripts/backup-explain.mjs pg_dump.err <код> [стадия]
 * Печатает markdown в stdout — workflow дописывает его в $GITHUB_STEP_SUMMARY.
 *
 * ⚠️ Секреты. GitHub маскирует их в ЛОГАХ, но сводка прогона — отдельная
 * страница, и туда маскирование не распространяется. Поэтому вырезаем сами:
 * сперва буквальным сравнением со значениями секретов (никаких регулярок —
 * пароль может содержать любые символы), потом по форме строки подключения.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_LINES = 15
const MAX_LINE_LEN = 300

/**
 * Убирает из текста всё, что похоже на секрет.
 * @param {string} text
 * @param {string[]} secrets значения секретов (буквально)
 */
export function redact(text, secrets = []) {
  let out = text
  for (const secret of secrets) {
    // Пустая или слишком короткая строка вырезала бы полтекста.
    if (!secret || secret.length < 4) continue
    out = out.split(secret).join('***')
    // Пароль внутри URL приезжает percent-encoded — сравнение «как есть» его
    // не поймает, поэтому пробуем и закодированную форму.
    const encoded = encodeURIComponent(secret)
    if (encoded !== secret) out = out.split(encoded).join('***')
  }
  // Строка подключения целиком: postgres://user:pass@host:5432/db
  out = out.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://***')
  // Форма «ключ=значение» из libpq-сообщений.
  out = out.replace(/\b(password|passfile|passphrase)=\S+/gi, '$1=***')
  // На всякий случай — «user:pass@host» без схемы.
  out = out.replace(/\b[\w.+-]+:[^\s:@/]{4,}@[\w.-]+/g, '***@***')
  return out
}

/** Частые причины: первое совпадение и выигрывает, поэтому порядок значим. */
const CAUSES = [
  {
    re: /unnamed prepared statement does not exist|prepared statement .* already exists|bind message supplies/i,
    hint:
      'Строка подключения ведёт в **транзакционный** пул (порт 6543). ' +
      'Он переиспользует соединения между запросами, а `pg_dump` держит одну ' +
      'сессию целиком. Нужен **Session pooler**, порт **5432**.',
  },
  {
    re: /Tenant or user not found/i,
    hint:
      'Через пул пользователь пишется как `postgres.<код-проекта>`, а не просто ' +
      '`postgres`. Скопируйте строку целиком из Supabase → Connect → Session pooler.',
  },
  {
    re: /password authentication failed|SASL authentication|authentication failed for user/i,
    hint:
      'Пароль в строке не подходит. Это пароль **базы**, а не аккаунта Supabase; ' +
      'сбросить его можно в Supabase → Settings → Database → Reset database password. ' +
      'Спецсимволы в пароле обязаны быть percent-encoded (`@` → `%40`).',
  },
  {
    re: /could not translate host name|Name or service not known|Network is unreachable|no address associated/i,
    hint:
      'Хост не разрешается или недоступен. Обычно это **Direct connection**: ' +
      'прямой адрес Supabase живёт только на IPv6, которого у раннеров GitHub нет. ' +
      'Возьмите Session pooler (`...pooler.supabase.com`).',
  },
  {
    re: /timeout expired|Connection timed out|could not connect to server/i,
    hint:
      'До сервера не достучались за 15 секунд. Чаще всего проект **на паузе** ' +
      '(бесплатный тариф усыпляет базу после недели простоя) — откройте его в ' +
      'панели Supabase и запустите прогон снова.',
  },
  {
    re: /server version mismatch|server version: \d|aborting because of server version/i,
    hint:
      'Клиент `pg_dump` старше сервера. Поднимите тег образа в шаге дампа ' +
      '(`postgres:17` → следующая версия) — образ выбран как раз для того, чтобы ' +
      'версию можно было назвать явно.',
  },
  {
    re: /remaining connection slots|Max client connections reached|too many clients/i,
    hint:
      'Свободных соединений в пуле нет — кто-то держит их прямо сейчас. ' +
      'Обычно проходит само; запустите прогон руками через несколько минут.',
  },
  {
    re: /permission denied for (schema|table|relation|sequence)|must be owner of/i,
    hint:
      'Пользователю не хватает прав на часть объектов. Дамп снимается под ' +
      '`postgres`; если в строке другой пользователь — замените.',
  },
  {
    re: /database "[^"]*" does not exist|role "[^"]*" does not exist/i,
    hint:
      'В строке неверное имя базы или пользователя. У Supabase база называется ' +
      '`postgres`, пользователь — `postgres.<код-проекта>`.',
  },
  {
    re: /SSL SYSCALL error|server closed the connection unexpectedly|connection to server .* closed|EOF detected/i,
    hint:
      'Соединение оборвалось на середине дампа. Если повторяется каждый день — ' +
      'база выросла настолько, что пул рвёт долгую сессию; тогда дамп нужно ' +
      'снимать по схемам (`--schema=public` отдельно) или с прямого соединения ' +
      'из окружения с IPv6.',
  },
  {
    re: /no pg_hba\.conf entry|SSL (connection )?(is )?required|sslmode/i,
    hint:
      'Сервер требует TLS. В строке подключения должно быть `?sslmode=require` ' +
      '(в строке из панели Supabase он уже есть — берите её целиком).',
  },
]

/** @param {string} text очищенный stderr @returns {string|null} */
export function explain(text) {
  for (const { re, hint } of CAUSES) if (re.test(text)) return hint
  return null
}

/** Первые MAX_LINES непустых строк, каждая не длиннее MAX_LINE_LEN. */
export function head(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '')
  const shown = lines.slice(0, MAX_LINES).map((l) => (l.length > MAX_LINE_LEN ? l.slice(0, MAX_LINE_LEN) + '…' : l))
  return { shown, hidden: Math.max(0, lines.length - MAX_LINES) }
}

const STAGE_LABEL = {
  dump: 'снятие дампа (`pg_dump`)',
  gzip: 'сжатие (`gzip`)',
  gpg: 'шифрование (`gpg`)',
}

/**
 * Собирает markdown для сводки прогона.
 * @param {{ stderr: string, code: number|string, stage?: string, secrets?: string[] }} p
 *   stage='size' — особый случай: pg_dump завершился без ошибки, но файл почти
 *   пустой; тогда в `code` приезжает размер в байтах, а не код возврата.
 */
export function buildSummary({ stderr, code, stage = 'dump', secrets = [] }) {
  const clean = redact(stderr ?? '', secrets)
  const { shown, hidden } = head(clean)
  // Пустой дамп почти всегда про права: подключились, но ни одной таблицы не
  // увидели. Общее «причина не из знакомых» здесь только сбивает с толку.
  const hint =
    explain(clean) ??
    (stage === 'size'
      ? 'Чаще всего это нехватка прав: подключение удалось, но `pg_dump` не увидел ' +
        'ни одной таблицы. Проверьте, что в строке пользователь `postgres.<код-проекта>` ' +
        '(Supabase → Connect → Session pooler), а не служебная роль с доступом к одной схеме.'
      : null)
  const out = []
  if (stage === 'size') {
    out.push(`❌ **Бэкап пустой.** \`pg_dump\` не ругался, но в файле всего ${code} байт —`)
    out.push('данные не выгрузились. Ниже то, что он всё-таки написал в stderr.')
  } else {
    out.push(`❌ **Бэкап не снят.** Упало на этапе: ${STAGE_LABEL[stage] ?? stage}, код ${code}.`)
  }
  out.push('')
  if (hint) {
    out.push('**Что случилось**')
    out.push('')
    out.push(hint)
    out.push('')
  } else {
    out.push('**Что случилось**')
    out.push('')
    out.push(
      'Причина не из знакомых — смотрите текст ниже. Если она окажется частой, ' +
        'добавьте её в `.github/scripts/backup-explain.mjs` вместе с проверкой.',
    )
    out.push('')
  }
  out.push('**Что сказал сервер**')
  out.push('')
  if (shown.length === 0) {
    out.push('_Сообщения нет — процесс умер молча (чаще всего это обрыв сети или нехватка памяти)._')
  } else {
    out.push('```')
    out.push(...shown)
    if (hidden > 0) out.push(`… ещё ${hidden} строк(и) — целиком в логе шага.`)
    out.push('```')
  }
  out.push('')
  out.push('_Пароль и строка подключения из этого текста вырезаны._')
  return out.join('\n')
}

// --- запуск из workflow -----------------------------------------------------
// ⚠️ Сверяем ПУТЬ целиком, а не окончание имени: тест называется
// test-backup-explain.mjs и тоже оканчивается на «backup-explain.mjs» — при
// проверке через endsWith модуль печатал сводку прямо посреди прогона теста.
const isMain = !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  const [, , file, code = '1', stage = 'dump'] = process.argv
  let stderr = ''
  try {
    stderr = readFileSync(file, 'utf8')
  } catch {
    stderr = ''
  }
  const secrets = [process.env.DB_URL, process.env.PASSPHRASE].filter(Boolean)
  process.stdout.write(buildSummary({ stderr, code, stage, secrets }) + '\n')
}
