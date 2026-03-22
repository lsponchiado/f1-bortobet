/**
 * Re-exporta a lógica de backup do app principal.
 * Quando migrar para monorepo, trocar por import de @bortobet/db.
 */
export { applyBackupsForSession } from '../../src/lib/backups.js';
