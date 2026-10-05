// Парадная дверь студии преподавателя (архитектура §2): Главная ученика
// показывает блок «Преподаватель» и плашки заданий и берёт их счётчики.
export { AssignmentsNotice, TeacherBlock, loadAssignmentCounts, type AssignmentCounts } from './TeacherBlock'
// Каркас: число «ждут проверки» на вкладке «Задания» (PLAN.md Ф2.10).
// Приглашение «Ведёшь учеников?» каркас грузит лениво, как экран.
export { useWaitingCount } from './waitingCount'
