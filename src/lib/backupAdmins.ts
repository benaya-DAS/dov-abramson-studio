// Who may run backup actions from the user menu (enforced again in the
// /api/backup and /api/restore routes - this list is not just cosmetic).
// Lowercase. The automatic backup on "חודש חדש" runs for anyone - see
// NewMonthButton.

/** "צור גיבוי עכשיו" - a backup only adds a file, it can't hurt anything. */
export const BACKUP_ADMIN_EMAILS = [
  "benaya@studiodov.com",
  "dov@studiodov.com",
  "amit@studiodov.com",
  "mirit@studiodov.com",
];

/** What the restore dialog makes you type - checked again by /api/restore. */
export const CONFIRM_RESTORE_WORD = "שחזור";

/** "שחזור מגיבוי" - replaces everyone's data, so a deliberately short list. */
export const RESTORE_ADMIN_EMAILS = ["benaya@studiodov.com", "dov@studiodov.com"];

function inList(list: string[], email: string | null | undefined) {
  return !!email && list.includes(email.trim().toLowerCase());
}

export function canRunManualBackup(email: string | null | undefined): boolean {
  return inList(BACKUP_ADMIN_EMAILS, email);
}

export function canRestore(email: string | null | undefined): boolean {
  return inList(RESTORE_ADMIN_EMAILS, email);
}
