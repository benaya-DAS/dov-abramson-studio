// Who sees "צור גיבוי עכשיו" in the user menu (and may trigger a manual
// backup through /api/backup). Lowercase. The automatic backup before
// "חודש חדש" runs for anyone - see NewMonthButton.
export const BACKUP_ADMIN_EMAILS = ["benaya@studiodov.com"];

export function canRunManualBackup(email: string | null | undefined): boolean {
  return !!email && BACKUP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
