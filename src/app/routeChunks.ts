// ============================================================================
// Экраны-роуты: ленивые, но с предзагрузкой — и БЕЗ подвисания на Suspense.
//
// Зачем не обычный React.lazy. Все роуты ленивые: чанк качается в момент
// перехода. Обычный lazy при первом показе экрана обязательно «подвисает» —
// React рисует заглушку «Загрузка…», даже если модуль уже лежит в памяти.
// Для перехода это приговор: браузер снимает «новый» кадр сразу, и на нём
// оказывается спиннер. То есть анимация красиво показывает заглушку.
// (Замерено пробой: при переходе на вкладку кадр содержал «Загрузка…».)
//
// Решение: помним разрешённый модуль сами. Если экран уже подгружен —
// отдаём настоящий компонент напрямую, Suspense не участвует вовсе. Пока не
// подгружен — работает обычный lazy с заглушкой, как раньше.
//
// Прогрев для ссылок (shared/ui/AppLink) — этот же реестр: он регистрирует
// себя в shared/lib/routePreload при импорте (App грузит его до первого
// рендера). Ссылка не импортирует каркас напрямую (§2).
//
// ⚠️ Один источник правды: App.tsx берёт компоненты ОТСЮДА. Свои import() с
// теми же путями рядом заводить нельзя — разъедутся при первом переименовании,
// и греться будет не тот кусок (а по поведению это почти не отличить).
// ============================================================================
import { createElement, lazy, type ComponentType } from 'react'
import { registerRoutePreloader } from '../shared/lib/routePreload'

interface RouteScreen {
  (): ReturnType<typeof createElement>
  /** Подгрузить экран заранее. После неё показ идёт без Suspense. */
  preload: () => Promise<void>
  /** Уже готов к мгновенному показу? */
  ready: () => boolean
}

function makeRoute<M>(load: () => Promise<M>, pick: (m: M) => ComponentType): RouteScreen {
  let resolved: ComponentType | null = null
  const Lazy = lazy(async () => {
    const m = await load()
    resolved = pick(m)
    return { default: resolved }
  })

  const Screen = (() =>
    createElement(resolved ?? Lazy)) as RouteScreen

  Screen.preload = async () => {
    if (resolved) return
    resolved = pick(await load())
  }
  Screen.ready = () => resolved !== null
  return Screen
}

/**
 * Экраны по адресам. Ключ — начало адреса; побеждает самое длинное совпадение,
 * поэтому «/teachers» не путается с «/teacher».
 */
export const routeScreens = {
  // Восстановление пароля — публичные экраны, в стартовый бандл не тянем:
  // на них попадают один раз и по ссылке из письма.
  '/forgot': makeRoute(() => import('../features/auth/ForgotPasswordPage'), (m) => m.ForgotPasswordPage),
  '/reset-password': makeRoute(() => import('../features/auth/ResetPasswordPage'), (m) => m.ResetPasswordPage),
  '/practice': makeRoute(() => import('../features/practice/PracticePage'), (m) => m.PracticePage),
  '/pronunciation': makeRoute(() => import('../features/pronunciation/PronunciationPage'), (m) => m.PronunciationPage),
  '/conversation': makeRoute(() => import('../features/conversation/ConversationPage'), (m) => m.ConversationPage),
  '/grammar': makeRoute(() => import('../features/grammar/GrammarPage'), (m) => m.GrammarPage),
  '/study': makeRoute(() => import('../features/study/StudyPage'), (m) => m.StudyPage),
  '/settings': makeRoute(() => import('../features/settings/SettingsPage'), (m) => m.SettingsPage),
  '/progress': makeRoute(() => import('../features/progress/ProgressPage'), (m) => m.ProgressPage),
  '/placement': makeRoute(() => import('../features/onboarding/PlacementTest'), (m) => m.PlacementTest),
  '/onboarding': makeRoute(() => import('../features/onboarding/OnboardingFlow'), (m) => m.OnboardingFlow),
  '/teachers': makeRoute(() => import('../features/landing/TeachersPage'), (m) => m.TeachersPage),
  '/teacher': makeRoute(() => import('../features/teacher/TeacherPage'), (m) => m.TeacherPage),
  '/schedule': makeRoute(() => import('../features/schedule/SchedulePage'), (m) => m.SchedulePage),
  '/assignments': makeRoute(() => import('../features/teacher/AssignmentsPage'), (m) => m.AssignmentsPage),
  '/writing': makeRoute(() => import('../features/writing/WritingPage'), (m) => m.WritingPage),
  '/self-material': makeRoute(
    () => import('../features/study/SelfMaterialPage'),
    (m) => m.SelfMaterialPage,
  ),
  '/quests': makeRoute(() => import('../features/quests/QuestsPage'), (m) => m.QuestsPage),
  '/program': makeRoute(() => import('../features/program/ProgramPage'), (m) => m.ProgramPage),
  '/privacy': makeRoute(() => import('../features/legal/LegalPage'), (m) => m.PrivacyPage),
  '/terms': makeRoute(() => import('../features/legal/LegalPage'), (m) => m.TermsPage),
  '/pricing': makeRoute(() => import('../features/billing/PricingPage'), (m) => m.PricingPage),
  '/pay': makeRoute(() => import('../features/billing/PayPage'), (m) => m.PayPage),
  '/invite': makeRoute(() => import('../features/referral/InvitePage'), (m) => m.InvitePage),
  '/admin': makeRoute(() => import('../features/admin/AdminPage'), (m) => m.AdminPage),
} satisfies Record<string, RouteScreen>

/**
 * Витрина дизайн-системы (/dev/ui) — только в разработке. В сборке
 * import.meta.env.DEV = false, ветка вырезается вместе с import(): экрана нет
 * ни в бандле, ни в офлайн-кэше PWA.
 */
export const devShowcase: RouteScreen | null = import.meta.env.DEV
  ? makeRoute(() => import('../features/dev/UiShowcase'), (m) => m.UiShowcase)
  : null

function screenFor(to: string): RouteScreen | null {
  // «/practice?m=review» — экран «/practice»: без этого ссылки с параметрами
  // (прогресс → практика, лендинг → вход, тарифы → оплата) экран не грели
  const path = to.split(/[?#]/)[0] ?? to
  let best: string | null = null
  for (const key of Object.keys(routeScreens)) {
    if ((path === key || path.startsWith(key + '/')) && (!best || key.length > best.length)) {
      best = key
    }
  }
  return best ? routeScreens[best as keyof typeof routeScreens] : null
}

/** Начать качать экран, ничего не дожидаясь (наведение, касание). */
function warmRoute(path: string): void {
  screenFor(path)?.preload().catch(() => {})
}

/**
 * Дождаться экрана, но не дольше `timeout`.
 *
 * @returns true — можно переходить с анимацией; false — не успели, лучше
 *          обычный переход, чем анимация с заглушкой.
 *
 * Адреса без ленивой загрузки (Главная, вход) сразу дают true.
 */
function preloadRoute(path: string, timeout = 700): Promise<boolean> {
  const screen = screenFor(path)
  if (!screen) return Promise.resolve(true)
  if (screen.ready()) return Promise.resolve(true)
  return Promise.race([
    screen.preload().then(
      () => true,
      // сеть отвалилась: пусть роутер сам покажет ошибку, а не мы анимацию
      () => false,
    ),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout)),
  ])
}

registerRoutePreloader({ warm: warmRoute, preload: preloadRoute })
