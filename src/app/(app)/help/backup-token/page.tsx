import { KeyRound } from "lucide-react";

// Linked from the backup/restore status when GITHUB_BACKUP_TOKEN is missing
// or expired (BackupStatus.tsx). The same steps are in docs/backups.md.
export default function BackupTokenHelpPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 text-slate-700 dark:text-slate-200">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound size={20} className="text-slate-500 dark:text-slate-400" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">חידוש מפתח הגישה לגיבויים</h1>
      </div>

      <p className="mb-4 text-sm leading-relaxed">
        הכפתורים &quot;צור גיבוי עכשיו&quot; ו&quot;שחזור מגיבוי&quot; משתמשים במפתח גישה ל־GitHub, שתוקפו מוגבל (בדרך
        כלל שנה). כשהוא פג או חסר, צריך ליצור מפתח חדש ולשמור אותו ב־Vercel - כ־5 דקות.{" "}
        <b>הגיבויים האוטומטיים (פעמיים ביום) ממשיכים לעבוד גם בלי המפתח הזה.</b>
      </p>

      <h2 className="mb-2 mt-6 font-semibold text-slate-900 dark:text-slate-100">1. יצירת מפתח חדש ב־GitHub</h2>
      <ol className="list-decimal space-y-1.5 pr-5 text-sm leading-relaxed">
        <li>
          נכנסים ל־GitHub עם החשבון שמחזיק את קוד האפליקציה (<span dir="ltr">benaya-DAS</span>) ← תמונת הפרופיל ←{" "}
          <b>Settings</b>.
        </li>
        <li>
          בתחתית התפריט בצד: <b>Developer settings</b> ← <b>Personal access tokens</b> ← <b>Fine-grained tokens</b>.
        </li>
        <li>
          אם יש שם מפתח ישן בשם <span dir="ltr">studio backup button</span> - לוחצים עליו ←{" "}
          <b>Regenerate token</b>, בוחרים תוקף (שנה) ומאשרים. אם אין - <b>Generate new token</b> עם ההגדרות:
          <ul className="mt-1 list-disc space-y-0.5 pr-5">
            <li>
              <b>Token name:</b> <span dir="ltr">studio backup button</span>
            </li>
            <li>
              <b>Expiration:</b> שנה
            </li>
            <li>
              <b>Repository access:</b> <b>Only select repositories</b> ← רק <span dir="ltr">dov-abramson-studio</span>
            </li>
            <li>
              <b>Repository permissions</b> ← <b>Actions:</b> <span dir="ltr">Read and write</span> (שום הרשאה אחרת)
            </li>
          </ul>
        </li>
        <li>
          מעתיקים את המפתח שמופיע (מתחיל ב־<span dir="ltr">github_pat_</span>). הוא מוצג <b>פעם אחת בלבד</b>, ואין
          לשלוח אותו לאף אחד.
        </li>
      </ol>

      <h2 className="mb-2 mt-6 font-semibold text-slate-900 dark:text-slate-100">2. שמירת המפתח ב־Vercel</h2>
      <ol className="list-decimal space-y-1.5 pr-5 text-sm leading-relaxed">
        <li>
          ב־Vercel נכנסים לפרויקט של האפליקציה ← <b>Settings</b> ← <b>Environment Variables</b>.
        </li>
        <li>
          ליד <span dir="ltr">GITHUB_BACKUP_TOKEN</span> לוחצים <b>⋯</b> ← <b>Edit</b>, מדביקים את המפתח החדש ושומרים.
          (אם המשתנה לא קיים - <b>Add Environment Variable</b> עם השם הזה.)
        </li>
        <li>
          <b>Deployments</b> ← בפריסה האחרונה <b>⋯</b> ← <b>Redeploy</b>. בלי הצעד הזה המפתח החדש לא נכנס לתוקף.
        </li>
        <li>אחרי כדקה־שתיים מרעננים את האפליקציה ומנסים שוב.</li>
      </ol>

      <p className="mt-6 rounded-lg bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:bg-night-800 dark:text-slate-400">
        אם GitHub מציג &quot;We failed to generate the API credential&quot; - זו תקלה זמנית אצלם. מוחקים את המפתח
        שנכשל ומנסים שוב מאוחר יותר.
      </p>
    </div>
  );
}
