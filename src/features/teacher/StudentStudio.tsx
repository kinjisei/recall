// ============================================================================
// Студия ученика в приложении — под шапкой карточки (макеты t6-2, d10-1;
// PLAN.md Ф2.17-4б-2): «Уроки» (блок расписания, его даёт карточка) и рядом
// домашка на неделю с тремя плашками — в две колонки, когда карточке хватает
// ширины (контейнер @2xl, 672), иначе столбиком; ниже «Разделы» — шесть
// плиток, внизу место тарифа и отвязка. Имя, статус, уровень и связь — в шапке (features/students),
// здесь их нет. Раздел открывается экраном вместо карточки (CardDetail,
// StudioSection) — раскрывашек под «Ещё» больше нет (PLAN.md Ф2.11б-2).
// ============================================================================
import { useState, type ReactNode, type Ref } from 'react'
import { Button } from '../../shared/ui/Button'
import { useConfirm } from '../../shared/ui/ConfirmDialog'
import { UndoToast } from '../../shared/ui/UndoToast'
import { useLanguage } from '../../context/LanguageContext'
import { setStudentSeat, unlinkStudent, type StudentInfo } from '../../lib/teacher'
import type { StudentDiagnostics } from '../../lib/diagnostics'
import { HomeworkSection } from './HomeworkSection'
import { HomeworkComposer } from './HomeworkComposer'
import { SectionTiles, StatTiles } from './StudioTiles'
import type { StudioSection } from './studioSections'

export function StudentStudio({
  student,
  name,
  lessons,
  diag,
  diagLoading,
  tilesRef,
  onOpen,
  onChanged,
  covered = true,
  seatsKnown = false,
}: {
  student: StudentInfo
  /** Имя из карточки — подпись учителя. */
  name: string
  /** Блок «Уроки» (features/schedule) — левая колонка. */
  lessons: ReactNode
  /** Общая диагностика (lib/diagnostics) — её же берут плашки, плитки и разделы. */
  diag: StudentDiagnostics | null
  diagLoading: boolean
  /** Плитки — к ним карточка возвращает прокрутку из раздела. */
  tilesRef?: Ref<HTMLDivElement>
  onOpen: (section: StudioSection) => void
  onChanged: () => void
  /** Покрыт ли ученик тарифом: сверх мест AI-возможности у него обычные, бесплатные. */
  covered?: boolean
  /** Можно ли ему дать место (есть лимит мест и статус занимает место). */
  seatsKnown?: boolean
}) {
  const { lang: appLang } = useLanguage()
  const [composing, setComposing] = useState(false)
  /** Растёт после выдачи домашки — блок перечитывает себя, карточка не мигает. */
  const [hwVersion, setHwVersion] = useState(0)
  const p = student.profile

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 @2xl:grid-cols-2">
        {/* «Уроки» тянутся на высоту ряда, как в d10-1 */}
        <div className="flex min-w-0 flex-col [&>section]:flex-1">{lessons}</div>
        <div className="flex min-w-0 flex-col gap-4">
          {/* Домашка — единственное, что нужно и до урока, и после. */}
          <HomeworkSection studentId={p.id} reloadKey={hwVersion} onCompose={() => setComposing(true)} />
          {/* Три числа, за которыми преподаватель и приходит. */}
          <StatTiles diag={diag} loading={diagLoading} onOpen={onOpen} />
        </div>
      </div>

      {/* Остальное — плитками: нужно раз в месяц, но видно сразу, что внутри. */}
      <div ref={tilesRef} className="flex flex-col gap-3">
        <SectionTiles
          studentId={p.id}
          level={p.level ?? null}
          diag={diag}
          diagLoading={diagLoading}
          lang={appLang}
          onOpen={onOpen}
        />
      </div>

      <StudioFooter studentId={p.id} name={name} covered={covered} seatsKnown={seatsKnown} onChanged={onChanged} />

      {composing && (
        <HomeworkComposer
          studentId={p.id}
          studentName={name}
          // ⚠️ Язык — из переключателя EN/ES в шапке, как весь раздел
          // преподавателя (см. WordPicker), а не profile.native_lang: это РОДНОЙ
          // язык ученика, и пункт «слова» считал бы не ту колоду.
          lang={appLang}
          // Уровень нужен подбору текста; null (тест не проходили) подбор не завышает.
          level={p.level ?? null}
          onClose={() => setComposing(false)}
          onCreated={() => setHwVersion((v) => v + 1)}
        />
      )}
    </div>
  )
}

/**
 * Место тарифа и отвязка — тихой строкой внизу карточки (решение владельца
 * 10.10.2026). «Убрать из тарифа» / «Включить в тариф» (журнал п.71, 9): у
 * ученика вне тарифа AI по бесплатным лимитам, место свободно для другого.
 * Убрал — тост «Вернуть» (как у архива, s3), а не вопрос заранее.
 */
function StudioFooter({
  studentId,
  name,
  covered,
  seatsKnown,
  onChanged,
}: {
  studentId: string
  name: string
  covered: boolean
  seatsKnown: boolean
  onChanged: () => void
}) {
  const [seatBusy, setSeatBusy] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<number | null>(null)
  const { confirm, dialog } = useConfirm()

  const setSeat = async (on: boolean) => {
    setSeatBusy(true)
    setError(null)
    try {
      await setStudentSeat(studentId, on)
      onChanged()
      setToast(on ? null : Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить место')
    } finally {
      setSeatBusy(false)
    }
  }

  const unlink = async () => {
    const ok = await confirm({
      title: 'Отвязать от приложения?',
      body: `${name} сохранит аккаунт и прогресс, карточка останется в твоём списке. Но ты перестанешь видеть занятия и не сможешь назначать задания.`,
      action: 'Отвязать',
    })
    if (!ok) return
    setUnlinking(true)
    setError(null)
    try {
      await unlinkStudent(studentId)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отвязать')
      setUnlinking(false)
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-1 border-t border-tint/[0.06] pt-3" data-studio-footer>
      {error && <p className="text-sm text-danger">{error}</p>}
      {seatsKnown && (
        <div>
          <Button size="sm" variant="ghost" loading={seatBusy} onClick={() => void setSeat(!covered)}>
            {covered ? 'Убрать из тарифа' : 'Включить в тариф'}
          </Button>
          {covered && (
            <p className="px-3 text-xs text-fg-muted">
              {name} останется в списке, но AI — по бесплатным лимитам; место освободится для другого ученика.
            </p>
          )}
        </div>
      )}
      <Button size="sm" variant="ghost" className="self-start text-danger-soft-fg" loading={unlinking} onClick={() => void unlink()}>
        Отвязать
      </Button>
      {toast && (
        <UndoToast
          key={toast}
          text={`${name} — вне тарифа`}
          onAction={() => void setSeat(true)}
          onClose={() => setToast(null)}
        />
      )}
      {dialog}
    </div>
  )
}
