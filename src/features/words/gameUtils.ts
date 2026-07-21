// ============================================================================
// Утилиты мини-игр раздела «Слова»: перемешивание, выборка, сравнение ответов
// и связь с FSRS.
//
// Правило (выбрано пользователем): в играх штрафуем, но не поощряем — ошибка
// по слову из колоды помечает карточку как «again» (вернётся на повтор
// раньше), а верный ответ расписание НЕ трогает, чтобы лёгкая игра случайно
// не «засчитала» слово выученным.
// ============================================================================
import { reviewCard } from '../../lib/fsrs'
import { addCardsBulk, getDefaultDeck } from '../../lib/cards'
import type { PoolItem } from '../../lib/wordPool'
import type { AppLang } from '../../types'

// shuffle/sample/pickWords живут рядом с пулом (lib), normalize — в lib/text;
// здесь только реэкспорт, чтобы игры брали всё нужное из одного места.
export { shuffle, sample, pickWords } from '../../lib/wordPool'
export { normalizeAnswer as normalize } from '../../lib/text'

/**
 * Ошибка в игре — «ничего не терять»:
 *  • слово из колоды → вернуть карточку на повтор (again);
 *  • слово из пака (карточки ещё нет) → добавить в колоду, чтобы ошибка не
 *    пропала — дальше оно пойдёт по расписанию в «Повторение». addCardsBulk
 *    сам пропускает дубли, так что повторная ошибка не плодит карточки.
 * Тихо игнорирует сбои: игра не должна падать из-за сети.
 */
export function markWrong(item: PoolItem, lang: AppLang): void {
  if (item.card) {
    void reviewCard(item.card, item.state ?? null, 'again').catch(() => {})
    return
  }
  void (async () => {
    try {
      const deck = await getDefaultDeck(lang)
      await addCardsBulk(deck.id, [
        { front: item.term, back: item.translation, example: item.example },
      ])
    } catch {
      /* сеть/лимит — не критично */
    }
  })()
}
