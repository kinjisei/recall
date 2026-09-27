#!/usr/bin/env node
// Сторож границ: кто кого импортирует (архитектура §2).
// Правила — boundaries.config.cjs, движок — dependency-cruiser.
// Запуск: node scripts/checks/boundaries.mjs [--prune | --allow <путь> | --init]
import { cruise } from 'dependency-cruiser'
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options'
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config'
import { settle } from './_baseline.mjs'

process.chdir(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))

const options = await extractDepcruiseOptions('./scripts/checks/boundaries.config.cjs')
const result = await cruise(
  ['src'],
  { ...options, validate: true, outputType: 'json' },
  undefined,
  { tsConfig: extractTSConfig('tsconfig.app.json') },
)
const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output

const comments = Object.fromEntries(options.ruleSet.forbidden.map((r) => [r.name, r.comment]))
const current = {}
for (const v of output.summary.violations) current[`${v.rule.name} | ${v.from} → ${v.to}`] = 1

const ok = settle({
  name: 'границы',
  file: 'scripts/checks/baseline/boundaries.json',
  about:
    'Сторож границ (scripts/checks/boundaries.mjs): импорты, нарушающие правила архитектуры §2 на момент появления сторожа. ' +
    'Уходят по мере переезда разделов (PLAN.md Ф3). Новые сюда не добавляются.',
  current,
  total: false,
  describe: (key) => {
    const rule = key.split(' | ')[0]
    return `${key}\n    → ${comments[rule] ?? ''}`
  },
})
process.exitCode = ok ? 0 : 1
