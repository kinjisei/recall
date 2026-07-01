import { Card } from '../../components/Card'

export function ConversationPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">💬 Диалог</h1>
      <Card>
        <p className="text-slate-600 dark:text-slate-300">
          Разговор с AI-собеседником и проверка письма (Gemini).
        </p>
        <p className="mt-2 text-sm text-slate-400">
          В разработке — Worker 4.
        </p>
      </Card>
    </div>
  )
}
