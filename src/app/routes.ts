// ============================================================================
// Все адреса приложения — одной таблицей (архитектура §16).
//
// Кто куда пускается, решает эта таблица, а не экран: где экран живёт в
// каркасе (без входа / после входа на весь экран / после входа в общей рамке),
// открывается ли он до онбординга, нужна ли роль. App.tsx только рисует
// таблицу, ProtectedRoute читает из неё исключения онбординга.
//
// ⚠️ Это видимость, а не защита. Настоящую защиту держит сервер: RLS и RPC
// сами проверяют и вход, и роль (admin_* — is_admin).
//
// Роли преподавателя здесь пока нет намеренно: /teacher для не-преподавателя
// показывает приглашение «Я веду учеников», это часть продукта, а не запрет.
// Меню и доступ по роли учителя включаются в PLAN.md Ф2.10.
// ============================================================================
import type { ComponentType } from 'react'
import { devShowcase, routeScreens } from './routeChunks'
import { LoginPage } from '../features/auth/LoginPage'
import { DashboardPage } from '../features/dashboard/DashboardPage'

/**
 * Где экран живёт в каркасе:
 *   public     — без входа, на весь экран (вход, восстановление пароля);
 *   open       — и гостю, и вошедшему: гостю — на весь экран, вошедшему — в
 *                общей рамке с меню (тарифы, лендинг, оферта, политика).
 *                Раньше тарифы у вошедшего открывались отдельным окном без
 *                меню, и уйти можно было только «Назад» (правка владельца
 *                30.09.2026);
 *   fullscreen — после входа, на весь экран со своими шагами (онбординг);
 *   app        — после входа, в общей рамке: шапка + навигация (Layout).
 */
export type RoutePlace = 'public' | 'open' | 'fullscreen' | 'app'

/** Роль, без которой экран не показывается (видимость, защищает сервер). */
export type RouteRole = 'admin'

export interface ScreenRoute {
  path: string
  place: RoutePlace
  screen: ComponentType
  /** Открывается и до онбординга: онбординг сам ведёт сюда. */
  beforeOnboarding?: true
  role?: RouteRole
}

/** Старый адрес → новый. Живёт там же, где жил экран, чтобы вход вёл туда же. */
export interface RedirectRoute {
  path: string
  place: RoutePlace
  redirect: string
}

export type AppRoute = ScreenRoute | RedirectRoute

// Экраны — лениво, из реестра routeChunks: он же греет их для ссылок. Вход и
// Главная — в стартовом бандле: с них начинается почти каждый визит.
export const ROUTES: AppRoute[] = [
  { path: '/login', place: 'public', screen: LoginPage },
  // Восстановление пароля — публичное: человек сюда и приходит именно потому,
  // что войти не может. /reset-password открывается по ссылке из письма,
  // поэтому адрес обязан быть в списке Redirect URLs в панели Supabase.
  { path: '/forgot', place: 'public', screen: routeScreens['/forgot'] },
  { path: '/reset-password', place: 'public', screen: routeScreens['/reset-password'] },
  // Открытые страницы: гостю — без рамки, вошедшему — в рамке. До
  // онбординга тоже открываются: юридические ссылки есть на входе, тарифы —
  // в меню аватара.
  { path: '/privacy', place: 'open', screen: routeScreens['/privacy'], beforeOnboarding: true },
  { path: '/terms', place: 'open', screen: routeScreens['/terms'], beforeOnboarding: true },
  // тарифы — публичные, работают и без входа
  { path: '/pricing', place: 'open', screen: routeScreens['/pricing'], beforeOnboarding: true },
  // лендинг для репетиторов — публичный (его шарим в TG/визитках)
  { path: '/teachers', place: 'open', screen: routeScreens['/teachers'], beforeOnboarding: true },

  // онбординг — без общей рамки: свои шаги на весь экран
  { path: '/onboarding', place: 'fullscreen', screen: routeScreens['/onboarding'], beforeOnboarding: true },

  { path: '/', place: 'app', screen: DashboardPage },
  // хаб «Слова» вырос в «Практику» — старые ссылки не ломаем
  { path: '/flashcards', place: 'app', redirect: '/practice' },
  // «Ввод» слился с «Учёбой»: один экран, старая ссылка ведёт туда же
  { path: '/reader', place: 'app', redirect: '/study' },
  { path: '/pronunciation', place: 'app', screen: routeScreens['/pronunciation'] },
  { path: '/conversation', place: 'app', screen: routeScreens['/conversation'] },
  { path: '/settings', place: 'app', screen: routeScreens['/settings'] },
  { path: '/progress', place: 'app', screen: routeScreens['/progress'] },
  { path: '/study', place: 'app', screen: routeScreens['/study'] },
  { path: '/grammar', place: 'app', screen: routeScreens['/grammar'] },
  { path: '/practice', place: 'app', screen: routeScreens['/practice'] },
  // Тест уровня открывается и до онбординга: шаг «уровень» сам уводит новичка
  // на тест, а гвард возвращал его обратно, не дав пройти, — тест становился
  // недостижим для нового пользователя. По окончании теста PlacementTest
  // ставит markOnboarded, поэтому цикла нет.
  { path: '/placement', place: 'app', screen: routeScreens['/placement'], beforeOnboarding: true },
  { path: '/teacher', place: 'app', screen: routeScreens['/teacher'] },
  // расписание репетитора (Ф2.7): роли в таблице нет, как у /teacher —
  // не-репетитору экран сам объясняет и ведёт в студию
  { path: '/schedule', place: 'app', screen: routeScreens['/schedule'] },
  // «Мои уроки» ученика (Ф2.9, макет u2): вход — «Все уроки» на Главной и
  // уведомления об уроках; ученику без уроков экран сам скажет «пока нет»
  { path: '/lessons', place: 'app', screen: routeScreens['/lessons'] },
  { path: '/assignments', place: 'app', screen: routeScreens['/assignments'] },
  { path: '/writing', place: 'app', screen: routeScreens['/writing'] },
  { path: '/self-material', place: 'app', screen: routeScreens['/self-material'] },
  { path: '/quests', place: 'app', screen: routeScreens['/quests'] },
  { path: '/program', place: 'app', screen: routeScreens['/program'] },
  // «Как оплатить тариф»: тариф включается на аккаунт — только после входа
  { path: '/pay', place: 'app', screen: routeScreens['/pay'] },
  // «Пригласи коллегу» (Ф2.3): роли в таблице нет, как у /teacher —
  // не-репетитору экран сам объясняет, что приглашают репетиторы
  { path: '/invite', place: 'app', screen: routeScreens['/invite'] },
  { path: '/admin', place: 'app', screen: routeScreens['/admin'], role: 'admin' },
  // витрина дизайн-системы — только в разработке (routeChunks.devShowcase)
  ...(devShowcase ? [{ path: '/dev/ui', place: 'app' as const, screen: devShowcase }] : []),
]

/** Ленивый ли экран (из реестра routeChunks) — такому нужна заглушка Suspense. */
export function isLazyScreen(screen: ComponentType): boolean {
  return typeof (screen as { preload?: unknown }).preload === 'function'
}

const BEFORE_ONBOARDING = new Set(
  ROUTES.filter((r): r is ScreenRoute => 'screen' in r && r.beforeOnboarding === true).map((r) => r.path),
)

/** Можно ли открыть адрес, не пройдя онбординг (онбординг, тест уровня, открытые страницы). */
export function opensBeforeOnboarding(pathname: string): boolean {
  return BEFORE_ONBOARDING.has(pathname)
}

const OPEN = new Set(ROUTES.filter((r) => r.place === 'open').map((r) => r.path))

/** Открытая страница: гость видит её без рамки, вошедший — в общей рамке. */
export function opensForGuests(pathname: string): boolean {
  return OPEN.has(pathname)
}
