// Инициалы для аватара (лист s3: «инициалы из имени и фамилии»):
// «Әсел Жұмабаева» → «ӘЖ», одно слово — одна буква. Буквы — целиком, а не
// половинки суррогатной пары; верхний регистр по-русски (казахские тоже).
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => [...p][0] ?? '')
  return letters.join('').toLocaleUpperCase('ru') || '?'
}
