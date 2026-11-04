/**
 * Правила по официальным работам IELTS (журнал п.77, examples/official.mjs):
 * балл каждой — в ±0,5 от экзаменатора (П6), а по набору — без сдвига (П11):
 * завышать слабым и занижать сильным — та самая «лояльность», которую
 * заметил владелец. Средняя разница со знаком ловит перекос в одну сторону,
 * средняя по модулю — разброс.
 */
import { bandRow, isQuote, tyRow } from './rules.mjs'

/** Сдвиг по набору: в среднем не больше 0,25 в любую сторону. */
export const MAX_BIAS = 0.25

const fmt = (n) => (n > 0 ? '+' : '') + n.toFixed(2).replace('.', ',')

export function officialRules(ex, out) {
  const { grade } = out
  const pairs = [...(grade.errors ?? []), ...(grade.focus ?? []).flatMap((f) => f.examples)]
  const fake = pairs.filter((p) => p.was && !isQuote(ex.essay, p.was)).map((p) => `«${p.was}»`)
  return [
    { id: 'П1', ok: fake.length === 0, detail: fake.length ? `не цитата из текста: ${fake.join(', ')}` : '' },
    bandRow(ex.expect.band, grade),
    tyRow([...(grade.focus ?? []).flatMap((f) => [f.type, f.why]), ...(grade.strengths ?? []), ...(grade.improve ?? [])]),
  ]
}

/**
 * П11 по набору: `items` — [{ id, official, band }] у работ, на которые AI
 * ответил. Пустой набор — не «зелёное»: проверять было нечего.
 */
export function biasRow(items) {
  const got = items.filter((x) => typeof x.band === 'number')
  if (got.length === 0) return { id: 'П11', ok: false, detail: 'ни одной официальной работы с баллом' }
  const diffs = got.map((x) => x.band - x.official)
  const bias = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const mae = diffs.reduce((a, b) => a + Math.abs(b), 0) / diffs.length
  const within = diffs.filter((d) => Math.abs(d) <= 0.5).length
  const each = got.map((x) => `${x.official}→${x.band}`).join(', ')
  const ok = Math.abs(bias) <= MAX_BIAS
  const side = bias > 0 ? 'завышает' : 'занижает'
  return {
    id: 'П11',
    ok,
    detail: ok ? '' : `${side}: сдвиг ${fmt(bias)} (допуск ±${MAX_BIAS}), разброс ${mae.toFixed(2)}, в ±0,5 — ${within} из ${got.length}; ${each}`,
    stats: { bias, mae, within, n: got.length, each },
  }
}
