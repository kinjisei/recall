// ============================================================================
// «Методичка» учителя (макет d9-3, PLAN.md Ф2.17-4в-3): текст шириной чтения
// 680 и оглавление справа (MainAside size="toc"), сверху — закреплённая
// шапка «‹ Задания · Методичка · раздел 2 из 4». Раньше — аккордеоны: открыт
// один раздел, а где ты остановился, забывалось. Теперь — сплошной текст,
// место и пройденные разделы помнит устройство (guideReading). На телефоне
// оглавление раскрывается над текстом. Контент — src/data/teacher-guide.ts.
// ============================================================================
import { useState } from 'react'
import { teacherGuide, type GuideBlock } from '../../data/teacher-guide'
import { BackLink } from '../../shared/ui/BackButton'
import { RevealHeader } from '../../shared/ui/Disclosure'
import { Reveal } from '../../shared/ui/Reveal'
import { MainAside, useAsideSplit } from '../../shared/ui/layouts'
import { GuideToc, type TocSection } from './GuideToc'
import { useGuideReading } from './guideReading'
import { useInnerScreen } from './innerScreen'

const INTRO = 'Как вести учеников в Recall: рабочий цикл, реакции на диагностику, проверенные методики и типичные ошибки. Читается за 15 минут, применяется годами.'

const SECTIONS: TocSection[] = [
  { id: 'intro', title: 'Вступление', blocks: [] },
  ...teacherGuide.map((s, i) => ({ id: s.id, num: i + 1, title: s.title, blocks: s.blocks.map((b) => b.title) })),
]
const IDS = SECTIONS.map((s) => s.id)

type Chunk = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] }

/** Абзацы и списки: строки «• …» подряд — один список. */
function chunks(body: string[]): Chunk[] {
  const out: Chunk[] = []
  for (const p of body) {
    const last = out[out.length - 1]
    if (!p.startsWith('• ')) out.push({ kind: 'p', text: p })
    else if (last?.kind === 'ul') last.items.push(p.slice(2))
    else out.push({ kind: 'ul', items: [p.slice(2)] })
  }
  return out
}

function Block({ block }: { block: GuideBlock }) {
  return (
    <div data-guide-block className="flex scroll-mt-20 flex-col gap-4">
      <h3 className="mt-2.5 text-xl font-semibold">{block.title}</h3>
      {chunks(block.body).map((c, i) =>
        c.kind === 'ul' ? (
          <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5.5 text-lg leading-relaxed text-fg marker:text-accent-strong">
            {c.items.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-lg leading-relaxed text-fg">
            {c.text}
          </p>
        ),
      )}
      {block.sources && block.sources.length > 0 && (
        // строкой на источник, цель 44: ссылки в строке через «·» были 15 px в высоту
        <div className="-mt-1 text-note text-fg-muted">
          <p>Источники:</p>
          <ul className="flex flex-col">
            {block.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-fg-secondary">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function GuideSection({ onExit }: { onExit: () => void }) {
  useInnerScreen(true) // шапка своя — «‹ Задания · Методичка»
  const split = useAsideSplit()
  const { at, block, progress, read } = useGuideReading(IDS)
  const [tocOpen, setTocOpen] = useState(false)
  const go = (id: string, b?: number) => {
    const sec = document.getElementById(`guide-${id}`)
    const el = b === undefined ? sec : sec?.querySelectorAll('[data-guide-block]')[b]
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTocOpen(false)
  }
  const toc = <GuideToc sections={SECTIONS} at={at} block={block} read={read} progress={progress} onGo={go} />

  const text = (
    <div className="flex flex-col gap-4.5 pb-10">
      <p id="guide-intro" className="scroll-mt-20 text-lg leading-relaxed text-fg-secondary">
        {INTRO}
      </p>
      {teacherGuide.map((s, i) => (
        <section key={s.id} id={`guide-${s.id}`} aria-labelledby={`guide-h-${s.id}`} className="flex scroll-mt-20 flex-col gap-4.5">
          <h2 id={`guide-h-${s.id}`} className="mt-6 text-greeting font-semibold">
            <small className="mb-1.5 block text-sm font-semibold tracking-normal text-accent-strong">Раздел {i + 1}</small>
            {s.title}
          </h2>
          {s.intro && <p className="text-lg leading-relaxed text-fg">{s.intro}</p>}
          {s.blocks.map((b) => (
            <Block key={b.title} block={b} />
          ))}
        </section>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex min-h-12 items-center gap-3 text-body text-fg-secondary ${split ? 'sticky top-0 z-10 -mx-2 border-b border-line bg-glass px-2 backdrop-blur-xl backdrop-saturate-150' : ''}`}>
        <BackLink onClick={onExit} label="Задания" />
        <span>
          <b className="font-semibold text-fg">Методичка</b>
          {at > 0 && <span className="tabular-nums"> · раздел {at} из {teacherGuide.length}</span>}
        </span>
      </div>
      {split ? (
        <MainAside size="toc" label="Содержание" main={text} aside={toc} />
      ) : (
        <>
          <div>
            <RevealHeader open={tocOpen} onToggle={() => setTocOpen((o) => !o)} title="Содержание" meta={`Прочитано ${progress}%`} />
            <Reveal open={tocOpen}>
              <div className="mt-2">{toc}</div>
            </Reveal>
          </div>
          {text}
        </>
      )}
    </div>
  )
}
