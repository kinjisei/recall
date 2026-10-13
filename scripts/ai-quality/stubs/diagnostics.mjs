/**
 * Заглушка `src/lib/diagnostics.ts` для проверки качества AI (loader.mjs):
 * диагностика ученика — из examples/students.mjs, сводку для промпта строит
 * настоящий `lib/diagnosticsBrief.ts`.
 */
export const getStudentDiagnostics = async (studentId) => {
  const d = globalThis.__aiQuality?.diagnostics(studentId)
  if (!d) throw new Error(`нет ученика «${studentId}» в examples/students.mjs`)
  return d
}
