// ============================================================================
// Прогрев экранов для ссылок. AppLink греет ленивый чанк экрана заранее
// (наведение, касание) и переходит с анимацией, только когда экран готов.
//
// Сами экраны знает каркас (app/routeChunks) — а общий компонент ссылки его
// импортировать не может (§2: каркас импортирует всех, его — никто). Поэтому
// каркас при загрузке регистрирует здесь свой реестр, а ссылка зовёт его
// через эти функции. Регистрация идёт при импорте реестра — вместе с App, до
// первого рендера, то есть раньше любого нажатия. Без реестра (в приложении
// такого не бывает) ссылка работает как на адрес без ленивой загрузки: сразу.
// ============================================================================

export interface RoutePreloader {
  /** Начать качать экран, ничего не дожидаясь. */
  warm(path: string): void
  /** Дождаться экрана, но не дольше timeout: true — можно с анимацией. */
  preload(path: string, timeout?: number): Promise<boolean>
}

let registry: RoutePreloader | null = null

export function registerRoutePreloader(preloader: RoutePreloader): void {
  registry = preloader
}

/** Начать качать экран, ничего не дожидаясь (наведение, касание). */
export function warmRoute(path: string): void {
  registry?.warm(path)
}

/**
 * Дождаться экрана, но не дольше `timeout` (по умолчанию решает реестр).
 * @returns true — можно переходить с анимацией; false — не успели.
 */
export function preloadRoute(path: string, timeout?: number): Promise<boolean> {
  return registry ? registry.preload(path, timeout) : Promise.resolve(true)
}
