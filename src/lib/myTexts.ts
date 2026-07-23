// ============================================================================
// «Мои тексты» — собственные тексты ученика в читалке: вставка, PDF, DOCX, TXT.
// Хранение ТОЛЬКО в localStorage (recall.my_texts.<lang>): чужой копирайт не
// попадает в нашу БД, у каждого устройства свой список. Лимиты: 15 000 знаков
// на текст (обрезка с пометкой), максимум 10 текстов (старые вытесняются).
// Парсеры файлов грузятся ЛЕНИВО: pdfjs (~2МБ) и mammoth не попадают в бандл,
// пока пользователь не выбрал файл.
// ============================================================================
import type { AppLang } from '../types'

export interface MyText {
  id: string
  title: string
  body: string
  /** true — текст был обрезан по лимиту при добавлении. */
  truncated: boolean
  addedAt: string
}

export const MY_TEXT_LIMIT = 15_000
const MAX_TEXTS = 10

const key = (lang: AppLang) => `recall.my_texts.${lang}`

export function listMyTexts(lang: AppLang): MyText[] {
  try {
    const raw = localStorage.getItem(key(lang))
    const list = raw ? (JSON.parse(raw) as MyText[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function save(lang: AppLang, list: MyText[]): void {
  try {
    localStorage.setItem(key(lang), JSON.stringify(list))
  } catch {
    /* переполнен localStorage — молча не сохраняем, UI покажет список как есть */
  }
}

export function addMyText(lang: AppLang, title: string, body: string): MyText {
  const clean = body.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
  const truncated = clean.length > MY_TEXT_LIMIT
  const text: MyText = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || clean.slice(0, 40).split('\n')[0] || 'Без названия',
    body: truncated ? clean.slice(0, MY_TEXT_LIMIT) : clean,
    truncated,
    addedAt: new Date().toISOString(),
  }
  // новые сверху; лишние (старые) вытесняются
  save(lang, [text, ...listMyTexts(lang)].slice(0, MAX_TEXTS))
  return text
}

export function removeMyText(lang: AppLang, id: string): void {
  save(lang, listMyTexts(lang).filter((t) => t.id !== id))
}

/** Текст из файла: .txt как есть, .pdf через pdfjs, .docx через mammoth. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.txt') || file.type === 'text/plain') {
    return file.text()
  }
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist')
    // worker тем же ленивым чанком (иначе pdfjs требует внешний файл)
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const parts: string[] = []
    // читаем максимум ~40 страниц — больше не влезет в лимит текста
    const pages = Math.min(doc.numPages, 40)
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      parts.push(
        content.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
          .replace(/\s+/g, ' '),
      )
      if (parts.join('\n\n').length > MY_TEXT_LIMIT * 1.2) break
    }
    const text = parts.join('\n\n').trim()
    if (!text) throw new Error('В этом PDF нет текстового слоя (это скан) — распознать его нельзя.')
    return text
  }
  if (name.endsWith('.docx')) {
    // у браузерной сборки mammoth нет типов — интерфейс минимальный, описываем сами
    const mammoth = (await import('mammoth/mammoth.browser')) as {
      extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
    }
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return value
  }
  throw new Error('Поддерживаются файлы .txt, .pdf и .docx')
}
