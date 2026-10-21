// Парадная дверь раздела «Письмо» (архитектура §2): экран разбора сданного
// письма берут студия (features/teacher — «Письменные работы» и «Проверка
// работ» во «Заданиях»), сколько слов в тексте — и проверка по материалу;
// выбор балла — и «Новое письмо» учителя (d9-2, тот же вид, что в проверке d7-3).
export { WritingReviewScreen } from './WritingReviewScreen'
export { wordCount } from './essayMarks'
export { BandPicker } from './reviewParts'
