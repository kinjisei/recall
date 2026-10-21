// ============================================================================
// Отправка, начатая на другом экране (журнал п.76 (9)): в карточке «Диалог»
// на «Моей учёбе» (d12) человек пишет в тот же черновик `chat:<язык>`, что и
// поле «Диалога», а «Отправить» ведёт сюда с { sendDraft: true }. Здесь
// черновик уходит обычной отправкой — одной логикой чата: энергия, сбои,
// возврат текста в поле. Ждём, пока поднимется прошлая переписка (иначе
// реплика завела бы новую поверх старой); метку из адреса снимаем сразу —
// обновление страницы и «назад» не отправят второй раз.
// ============================================================================
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Состояние перехода, которое просит отправить черновик по прибытии. */
export const SEND_DRAFT_STATE = { sendDraft: true } as const

export function useSendOnArrival(ready: boolean, send: () => void): void {
  const location = useLocation()
  const navigate = useNavigate()
  const wanted = (location.state as { sendDraft?: boolean } | null)?.sendDraft === true
  const sendRef = useRef(send)
  const done = useRef(false)
  useEffect(() => {
    sendRef.current = send
  })
  useEffect(() => {
    if (!wanted || !ready || done.current) return
    done.current = true
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    sendRef.current()
  }, [wanted, ready, navigate, location.pathname, location.search])
}
