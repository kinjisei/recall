// Тест уровня-диапазона (lib/cefr): потолок, диапазон, «где сложнее».
// node scripts/test-cefr.mjs
import { levelRange, levelDisplay } from '../src/lib/cefr.ts'

let pass = 0
let fail = 0
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`)
  ok ? pass++ : fail++
}

// один кусок → одиночный уровень, без note
eq('single B1', levelRange(['B1']), { level: 'B1', note: '' })
// однородный текст → одиночный уровень
eq('all A2', levelRange(['A2', 'A2', 'A2']), { level: 'A2', note: '' })
// простое начало + сложный конец → потолок B2, «к концу»
eq('A1..B2 конец', levelRange(['A1', 'A1', 'B2']), { level: 'A1–B2', note: 'сложнее к концу' })
// сложное начало → «в начале»
eq('B2..A1 начало', levelRange(['B2', 'A1', 'A1']), { level: 'A1–B2', note: 'сложнее в начале' })
// пик в середине → «местами»
eq('A1 B2 A1', levelRange(['A1', 'B2', 'A1']), { level: 'A1–B2', note: 'местами сложнее' })
// потолок НЕ усредняется: 3×A1 + 1×C1 → верх C1 (а не A1/A2)
eq('ceiling not mean', levelRange(['A1', 'A1', 'A1', 'C1']).level, 'A1–C1')
// пустое
eq('empty', levelRange([]), { level: '', note: '' })
// мусорные значения фильтруются
eq('garbage filtered', levelRange(['', 'B1', 'X']), { level: 'B1', note: '' })
// display-строка с запятой
eq('display', levelDisplay(['A1', 'A1', 'B2']), 'A1–B2, сложнее к концу')
eq('display single', levelDisplay(['B1']), 'B1')

console.log(`\n${pass}/${pass + fail} ок`)
process.exit(fail ? 1 : 0)
