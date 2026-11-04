/**
 * Официальные работы IELTS с баллом экзаменатора — эталон для П6 и П11
 * (журнал п.77). Тексты — в `../official/essays.json` вне git (чужие тексты,
 * репозиторий открытый; откуда и как собрать — `../official/README.md`).
 * Нет файла — набор пуст, проверка говорит об этом, а не молчит.
 */
import { existsSync, readFileSync } from 'node:fs'

const FILE = new URL('../official/essays.json', import.meta.url)
const TASK = { 'academic-task2': 'task2', 'gt-task2': 'task2', 'gt-task1': 'gt1' }

export const OFFICIAL_MISSING = !existsSync(FILE)

export const OFFICIAL = OFFICIAL_MISSING
  ? []
  : JSON.parse(readFileSync(FILE, 'utf8'))
      .filter((e) => !e.skip && TASK[e.task])
      .map((e) => ({
        id: `off-${e.id}`,
        title: `Официальная работа IELTS · ${e.task} · балл экзаменатора ${e.band}`,
        official: e.band,
        task: { lang: 'en', mode: 'ielts', level: 'B2', settings: { ieltsTask: TASK[e.task] }, prompt: e.prompt },
        essay: e.essay,
        expect: { band: [e.band - 0.5, e.band + 0.5] },
        judge: `Экзаменатор: ${e.examinerComment}`,
      }))
