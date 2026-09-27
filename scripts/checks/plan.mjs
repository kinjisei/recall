#!/usr/bin/env node
// Сторож плана (журнал п.17): у каждого пункта docs/PLAN.md заполнены ВСЕ поля
// шаблона, в «Задании для сессии» есть текст задания, статус — один из пяти
// значков, а у ✅ — дата. В «Скиллах» законно «не нужен», но с причиной:
// проверка требует, чтобы анализ был (журнал п.17; решение владельца
// 27.09.2026 — голое «не нужен.» не проходит).
//
// Старые пункты с голым «не нужен.» — в baseline «к исправлению»: причину
// дописывает сессия, которая берёт пункт в работу (анализ скиллов она делает
// всё равно, правило плана п.8).
// Запуск: node scripts/checks/plan.mjs [--prune | --init] [--file <копия плана>]
import { readFileSync } from 'node:fs'
import { isMain, plural, rootPath, settle } from './_baseline.mjs'

export const FIELDS = ['Статус', 'Зачем', 'Что сделать', 'Готово, когда', 'Аппетит', 'Зависит от', 'Скиллы', 'Задание для сессии']
const STATUSES = ['⬜', '🔄', '✅', '⏸', '❌']

/** Пункты плана: заголовок «### <номер> — …» вне блоков кода, поля «- **Имя:** …». */
export function parsePlan(text) {
  const items = []
  let item = null
  let field = null
  let fence = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      fence = !fence
      if (item && field) item.fields[field].push(line)
      continue
    }
    if (!fence && /^#{1,3} /.test(line)) {
      const m = line.match(/^### (\S+) — /)
      item = m ? { id: m[1], fields: {}, order: [] } : null
      if (item) items.push(item)
      field = null
      continue
    }
    if (!item) continue
    const f = !fence && line.match(/^- \*\*(.+?):\*\*\s?(.*)$/)
    if (f) {
      // «Что сделать (владелец), после Ф0.1» — это поле «Что сделать»
      field = FIELDS.find((name) => f[1] === name || f[1].startsWith(name + ' ') || f[1].startsWith(name + ',')) ?? f[1]
      item.order.push(field)
      item.fields[field] = [f[2]]
    } else if (field) {
      item.fields[field].push(line)
    }
  }
  return items
}

export function problems(items) {
  const out = {}
  const add = (id, what) => (out[`${id} | ${what}`] = 1)
  const seen = new Set()
  for (const it of items) {
    if (seen.has(it.id)) add(it.id, 'номер пункта повторяется')
    seen.add(it.id)
    const value = (name) => (it.fields[name] ?? []).join('\n').trim()
    for (const name of FIELDS) if (!value(name)) add(it.id, `нет поля «${name}»`)

    const status = value('Статус')
    if (status && !STATUSES.some((s) => status.startsWith(s))) add(it.id, `статус не из ${STATUSES.join(' ')}`)
    if (status.startsWith('✅') && !/\d{2}\.\d{2}\.\d{4}/.test(status)) add(it.id, 'у ✅ нет даты')

    const task = value('Задание для сессии')
    const body = task.match(/```[^\n]*\n([\s\S]*?)```/)
    if (task && !(body && body[1].trim())) add(it.id, 'в «Задании для сессии» нет текста задания в блоке ```text')

    const skills = value('Скиллы')
    if (/^не нужен/i.test(skills)) {
      const reason = skills.replace(/^не нужен/i, '').replace(/[—–\-.,;:\s]+/g, ' ').trim()
      if (reason.split(' ').filter(Boolean).length < 2) add(it.id, '«Скиллы: не нужен» без причины («не нужен — потому что …»)')
    }
  }
  return out
}

if (isMain(import.meta.url)) {
  // --file <путь> — проверить копию плана (для проверки самого сторожа)
  const at = process.argv.indexOf('--file')
  const file = at !== -1 ? process.argv[at + 1] : rootPath('docs/PLAN.md')
  const items = parsePlan(readFileSync(file, 'utf8'))
  if (!items.length) {
    console.log('✖ план: в docs/PLAN.md не найдено ни одного пункта «### <номер> — …» — сломан разбор или формат')
    process.exitCode = 1
  } else {
    const ok = settle({
      name: `план (${plural(items.length, 'пункт', 'пункта', 'пунктов')})`,
      file: 'scripts/checks/baseline/plan.json',
      about:
        'Сторож плана (scripts/checks/plan.mjs): пункты docs/PLAN.md с незаполненными полями на момент появления сторожа. ' +
        'Причину в «Скиллы» дописывает сессия, которая берёт пункт в работу.',
      current: problems(items),
      describe: (key) => key,
      total: false,
    })
    process.exitCode = ok ? 0 : 1
  }
}
