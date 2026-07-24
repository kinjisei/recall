// ============================================================================
// Лендинг «для преподавателей» (роут /teachers, публичный — работает без
// входа). Продаёт teacher-режим Recall репетиторам английского в Казахстане.
// Цифры и решения — docs/monetization-draft.md (грилинг 22.07): тарифы
// 3000/5000/12000₸, триал 14 дней без карты, «приведи коллегу» (2 недели —
// только пригласившему: у новичка свои 14 дней пробного периода и так есть).
// Копирайт: конкретика вместо обещаний, боль → механизм → цена; без
// выдуманных отзывов (соц. доказательства появятся после пилота).
// ============================================================================
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/Brand'
import {
  IconCheck,
  IconMaterials,
  IconChart,
  IconPuzzle,
  IconRows,
  IconPrinter,
  IconCards,
  type IconLike,
} from '../../components/icons'

/** Главная кнопка действия — на регистрацию. */
function CTA({ label = 'Попробовать 14 дней бесплатно' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Link
        to="/login"
        className="lift inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--night-accent)] px-7 font-medium text-white"
      >
        {label}
      </Link>
      <span className="text-xs text-[var(--night-text-40)]">Карта не нужна · отмена в любой момент</span>
    </div>
  )
}

const TOOLS: { Icon: IconLike; title: string; desc: string }[] = [
  {
    Icon: IconMaterials,
    title: 'Материалы за 2 минуты',
    desc: 'Задай тему и уровень — AI составит текст с упражнениями под конкретную ученицу. Печать в PDF или назначение прямо в приложении.',
  },
  {
    Icon: IconCheck,
    title: 'Проверка с AI-черновиком',
    desc: 'Работа сдана — AI уже разобрал каждый ответ. Ты только соглашаешься или правишь вердикт и добавляешь комментарий.',
  },
  {
    Icon: IconChart,
    title: 'Диагностическая карта',
    desc: 'Слабые темы грамматики, буксующие слова, динамика за месяц — собирается сама из занятий, без твоих таблиц.',
  },
  {
    Icon: IconRows,
    title: 'Программа по неделям',
    desc: 'AI раскладывает план на 2–8 недель по слабым местам ученицы. Ты правишь и утверждаешь — она видит свою неделю.',
  },
  {
    Icon: IconPuzzle,
    title: 'AI-квесты по грамматике',
    desc: '«Собеседование», «Побег из комнаты» — разговорная практика на заданную тему между уроками. Вся переписка видна тебе.',
  },
  {
    Icon: IconPrinter,
    title: 'Отчёт родителям в 1 клик',
    desc: 'PDF на одну страницу: что изменилось за месяц, что уже получается, над чем работаем дальше. Родителям видно, за что они платят.',
  },
]

const PLANS = [
  { title: 'Мини', price: '3 000', per: '600 ₸ за ученицу', limit: 'до 5 учениц', hot: false },
  { title: 'Старт', price: '5 000', per: '500 ₸ за ученицу', limit: 'до 10 учениц', hot: true },
  { title: 'Про', price: '12 000', per: '400 ₸ за ученицу', limit: 'до 30 учениц', hot: false },
]

const FAQ = [
  {
    q: 'Ученицам нужно платить?',
    a: 'Нет. Пока у тебя активный тариф, твои ученицы пользуются приложением бесплатно, включая AI. Число мест зависит от тарифа: когда они кончатся, новая ученица не привяжется, пока не перейдёшь на тариф побольше.',
  },
  {
    q: 'Что будет после 14 дней пробного периода?',
    a: 'Ничего не списывается — карту мы не просим. В пробные две недели открыты все разделы и 12 разговоров с AI в день (реплика в «Диалоге», проверка письма, ход в квесте). Перевод слов, произношение, карточки и грамматика не считаются вообще. Понравится — оплатишь Kaspi-переводом, и разговоров станет 200 в день.',
  },
  {
    q: 'Это замена мне как преподавателю?',
    a: 'Нет — это твой ассистент между уроками. Материалы, проверку и план утверждаешь ты; AI убирает рутину, а не тебя.',
  },
  {
    q: 'Подходит только для английского?',
    a: 'Английский и испанский. Словарь, грамматика A1–C1, тексты, произношение и AI-диалоги — уже внутри.',
  },
]

export function TeachersPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--night-bg)] text-[var(--night-text)]">
      {/* шапка: логотип + вход */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[rgba(22,24,38,.85)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-md items-center justify-between px-5 py-3">
          <BrandLogo width={92} />
          <Link
            to="/login"
            className="flex min-h-[40px] items-center rounded-full border border-white/[0.12] px-4 text-sm text-[var(--night-text-70)]"
          >
            Войти
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-screen-md px-5 pb-16">
        {/* ---- Hero ---- */}
        <section className="flex flex-col items-center gap-6 pb-12 pt-10 text-center">
          <p className="rounded-full border border-[var(--night-accent-45)] px-3 py-1 text-xs text-[var(--night-accent-text)]">
            Для репетиторов английского и испанского
          </p>
          <h1 className="max-w-xl text-[2rem] font-semibold leading-tight tracking-tight">
            Твои ученики занимаются между уроками.
            <br />
            <span className="text-[var(--night-accent-text)]">А рутину делает AI.</span>
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-[var(--night-text-60)]">
            Recall берёт на себя то, что съедает вечера: подбор материала, проверку
            работ и учёт, кто что забыл. Ты остаёшься методистом и человеком, ради
            которого приходят. Стоит меньше одного твоего занятия в месяц.
          </p>
          <CTA />

          {/* signature: живой мини-отчёт — артефакт, которого нет у конкурентов */}
          <div className="mt-4 w-full max-w-sm rounded-2xl border border-white/[0.10] bg-white p-4 text-left text-black shadow-[0_18px_60px_rgba(0,0,0,.45)]">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">
              Отчёт о занятиях · за месяц
            </p>
            <p className="font-serif text-lg font-bold">Айгерим</p>
            <div className="mt-2 flex flex-col gap-1 text-[13px]">
              <p className="flex justify-between border-b border-neutral-200 pb-1">
                <span>Дней с занятиями</span>
                <span className="font-semibold">18 <span className="text-emerald-700">▲ 6</span></span>
              </p>
              <p className="flex justify-between border-b border-neutral-200 pb-1">
                <span>Средний балл заданий</span>
                <span className="font-semibold">84% <span className="text-emerald-700">▲ 12%</span></span>
              </p>
              <p className="flex justify-between">
                <span>Выучено слов</span>
                <span className="font-semibold">47</span>
              </p>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              Такой отчёт собирается в один клик — родители видят, за что платят.
            </p>
          </div>
        </section>

        {/* ---- Как это работает ---- */}
        <section className="border-t border-white/[0.06] py-10">
          <h2 className="text-center text-xl font-semibold">Как это работает</h2>
          <div className="mt-6 flex flex-col gap-3">
            {[
              ['Пригласи ученицу кодом', 'Она вводит код на своей Главной — и вы связаны. Никаких настроек.'],
              ['Назначай и проверяй', 'Материалы, наборы слов, квесты и программа — из карточки ученицы. Проверка приходит с готовым AI-разбором.'],
              ['Смотри, как растёт прогресс', 'Диагностика обновляется сама. Раз в месяц — отчёт родителям в PDF.'],
            ].map(([t, d], i) => (
              <div key={t} className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--night-accent-900)] text-sm font-bold text-[var(--night-accent-100)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[var(--night-text-60)]">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Инструменты ---- */}
        <section className="border-t border-white/[0.06] py-10">
          <h2 className="text-center text-xl font-semibold">Что внутри</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TOOLS.map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--night-accent-900)] text-[var(--night-accent-100)]">
                  <Icon size={18} />
                </span>
                <p className="mt-2.5 font-medium">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--night-text-60)]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Между уроками ---- */}
        <section className="border-t border-white/[0.06] py-10">
          <div className="rounded-2xl border border-[var(--night-accent-30)] bg-[rgba(145,132,217,.07)] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <IconCards size={20} className="text-[var(--night-accent-text)]" />
              Между уроками ученица не пропадает
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--night-text-70)]">
              Внутри — полноценное приложение для самостоятельных занятий. Слова
              сами возвращаются на повторение ровно тогда, когда начинают
              забываться, — ученице не нужно решать, что учить сегодня. Плюс
              60 уроков грамматики от A1 до C1, 476 фразовых глаголов, 911 идиом,
              тексты с переводом слова по тапу, проверка произношения и разговор
              с AI, который исправляет ошибки. 15 минут в день дают больше, чем
              час раз в неделю, — и это видно в диагностике.
            </p>
          </div>
        </section>

        {/* ---- Цены ---- */}
        <section className="border-t border-white/[0.06] py-10">
          <h2 className="text-center text-xl font-semibold">Цена — меньше часа твоей работы</h2>
          <p className="mx-auto mt-1 max-w-md text-center text-sm text-[var(--night-text-40)]">
            Средняя ставка репетитора — 5 000 ₸/час. Recall стоит от 3 000 ₸ в месяц,
            а ученицам — бесплатно.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.title}
                className={`rounded-2xl border p-4 text-center ${
                  p.hot
                    ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.10)]'
                    : 'border-white/[0.08] bg-[var(--night-surface)]'
                }`}
              >
                {p.hot && (
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--night-accent-text)]">
                    Выбор большинства
                  </p>
                )}
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 text-2xl font-semibold">
                  {p.price} <span className="text-sm font-normal text-[var(--night-text-40)]">₸/мес</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--night-text-40)]">{p.limit}</p>
                <p className="mt-2 text-sm text-[var(--night-accent-text)]">{p.per}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-[var(--night-text-40)]">
            Для сравнения: аналоги берут ~1 000 ₸ за ученика. Приведи коллегу — тебе 2 недели бесплатно.
          </p>
          <div className="mt-6">
            <CTA label="Начать бесплатный триал" />
          </div>
        </section>

        {/* ---- FAQ ---- */}
        <section className="border-t border-white/[0.06] py-10">
          <h2 className="text-center text-xl font-semibold">Частые вопросы</h2>
          <div className="mt-6 flex flex-col gap-3">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-2xl border border-white/[0.08] bg-[var(--night-surface)] p-4">
                <p className="font-medium">{f.q}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--night-text-60)]">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Финал ---- */}
        <section className="border-t border-white/[0.06] py-12 text-center">
          <h2 className="text-xl font-semibold">14 дней — достаточно, чтобы понять</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--night-text-60)]">
            Подключи одну реальную ученицу, назначь ей материал и посмотри на диагностику
            через неделю. Если не сэкономит тебе время — просто не плати.
          </p>
          <div className="mt-5">
            <CTA />
          </div>
          <p className="mt-8 text-xs text-[var(--night-text-40)]">
            <Link to="/pricing" className="underline">Все тарифы</Link> ·{' '}
            <Link to="/terms" className="underline">Условия</Link> ·{' '}
            <Link to="/privacy" className="underline">Конфиденциальность</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
