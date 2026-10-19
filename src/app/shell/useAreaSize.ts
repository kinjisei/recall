// Область и содержимое каркаса (правила d0): ОБЛАСТЬ — окно минус меню,
// СОДЕРЖИМОЕ — область минус поля 24 · 32 · 40.
//
// Считаем от ширины ОКНА, как в самих правилах (1280 − 240 = 1040 → поля 32 →
// 976), а не от замера блока: в Windows полоса прокрутки отнимает 15 px, и
// замер дал бы на 1280 поля 24 вместо 32, а на 1440 — «панель поверх» вместо
// сдвига недели (d2). Хуже того: панель, удлинившая страницу, включает полосу
// прокрутки, та сужает область — и решение «сдвиг / поверх» переключалось бы
// по кругу. От окна — стабильно; лишние 15 px поля съедают без вреда.
import { useCallback, useSyncExternalStore } from 'react'
import { contentOf } from '../../shared/lib/shellGeometry'

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

export interface AreaSize {
  area: number
  content: number
}

export function useAreaSize(menuPx: number, phone: boolean): AreaSize {
  const width = useSyncExternalStore(
    subscribe,
    useCallback(() => window.innerWidth, []),
  )
  const area = width - menuPx
  return { area, content: phone ? width : contentOf(area) }
}
