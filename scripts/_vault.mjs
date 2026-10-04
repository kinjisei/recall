// ============================================================================
// Секреты доставки уведомлений в Vault тестовой базы — на время проверки.
//
// Проверке доставки нужны свои notify_url и notify_secret. Раньше она на
// уборке просто удаляла их — и выключала доставку, которую настроили для
// живого телефона (туннель к dev:test, PLAN.md Ф2.9): пуши переставали
// приходить «сами», без единой ошибки. Теперь прежние значения запоминаются
// до прогона и возвращаются после.
// ============================================================================

const NAMES = "('notify_url', 'notify_secret')"
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

/**
 * @param {(query: string) => Promise<any[]>} sql запрос к тестовой базе (runSql)
 * @returns {Promise<{ set(url: string, secret: string): Promise<void>, clear(): Promise<void>, restore(): Promise<void> }>}
 */
export async function deliverySecrets(sql) {
  const saved = await sql(`select name, decrypted_secret from vault.decrypted_secrets where name in ${NAMES}`)
  const clear = () => sql(`delete from vault.secrets where name in ${NAMES}`)
  return {
    async set(url, secret) {
      await clear()
      await sql(`select vault.create_secret(${q(url)}, 'notify_url'); select vault.create_secret(${q(secret)}, 'notify_secret');`)
    },
    clear: async () => void (await clear()),
    async restore() {
      await clear()
      for (const s of saved) await sql(`select vault.create_secret(${q(s.decrypted_secret)}, ${q(s.name)})`)
    },
  }
}
