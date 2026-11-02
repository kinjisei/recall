// ============================================================================
// Справочник неправильных форм языка для подсветки слов плана (d8-4): грузится
// лениво (`lib/wordForms` `loadIrregular`); пока не пришёл — работают
// правила окончаний, после — и took ⇒ take, fue ⇒ ir.
// ============================================================================
import { useEffect, useState } from 'react'
import { loadIrregular, type IrregularForms } from '../../../lib/wordForms'
import type { AppLang } from '../../../types'

export function useIrregular(lang: AppLang): IrregularForms | undefined {
  const [forms, setForms] = useState<{ lang: AppLang; map: IrregularForms } | null>(null)
  useEffect(() => {
    let alive = true
    loadIrregular(lang)
      .then((map) => alive && setForms({ lang, map }))
      .catch(() => {
        /* без справочника — правила окончаний */
      })
    return () => {
      alive = false
    }
  }, [lang])
  return forms?.lang === lang ? forms.map : undefined
}
