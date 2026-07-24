// ============================================================================
// Подбор слов для одного раунда мини-игры.
//
// Правило: раунд собирается из ДВУХ корзин — свои слова (колода) и слова из
// паков. Своё преобладает (это то, что человек учит), но не занимает весь
// раунд. Раньше раунд набирался из колоды целиком, а паки подмешивались лишь
// при колоде меньше 24 слов — при большой колоде игры бесконечно крутили одни
// и те же слова («в практике почти во всех упражнениях они повторяются»).
//
// Модуль БЕЗ импортов — как distractors/recentWords/random: только такие файлы
// запускает Node в мини-тестах (scripts/test-wordpool.mjs), стрип типов не
// умеет достраивать расширения относительных путей. Поэтому крошечная выборка
// живёт здесь же, а историю показов подставляет вызывающий (lib/wordPool).
// ============================================================================

/** Доля раунда, отдаваемая своим словам. */
export const DECK_SHARE = 0.6

/** Минимум, который нужен подбору от элемента пула. */
export interface Pickable {
  term: string
}

/** n случайных элементов (частичный Фишер—Йетс, исходный массив не трогаем). */
function sampleSome<T>(arr: readonly T[], n: number): T[] {
  if (n >= arr.length) return [...arr]
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    out.push(copy[i])
  }
  return out
}

/**
 * Собирает раунд из n слов: сначала свежие (не показанные недавно) — сперва
 * своя квота, потом паки; если свежих не хватило, добираются остатки и лишь
 * в последнюю очередь недавно показанные.
 *
 * @param deck   свои слова (из колоды)
 * @param packs  слова из паков
 * @param recent недавно показанные термины (в нижнем регистре)
 */
export function pickRound<T extends Pickable>(
  deck: readonly T[],
  packs: readonly T[],
  n: number,
  recent: ReadonlySet<string>,
): T[] {
  const picked: T[] = []
  const have = new Set<string>()

  /** Добирает count слов из list; fresh — пропускать недавно показанные. */
  const add = (list: readonly T[], count: number, fresh: boolean) => {
    if (count <= 0) return
    const ok = list.filter((i) => {
      const key = i.term.toLowerCase()
      return !have.has(key) && (!fresh || !recent.has(key))
    })
    for (const it of sampleSome(ok, count)) {
      picked.push(it)
      have.add(it.term.toLowerCase())
    }
  }

  // квота своих слов; если паков нет — весь раунд из колоды, как раньше
  const deckQuota = packs.length === 0 ? n : Math.max(1, Math.round(n * DECK_SHARE))
  add(deck, deckQuota, true)
  add(packs, n - picked.length, true)
  // не набралось свежих — добираем остатками, в последнюю очередь недавние
  add(deck, n - picked.length, true)
  add(deck, n - picked.length, false)
  add(packs, n - picked.length, false)

  return picked
}
