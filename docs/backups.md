# גיבוי ושחזור מסד הנתונים

- **גיבוי אוטומטי פעמיים ביום** (בערך 06:20 ו־18:20 בחורף, 07:20 ו־19:20 בקיץ), לתיקייה `db-backups` ב־Shared Drive בגוגל דרייב.
- **גיבויים בני יותר מ־30 יום נמחקים** אוטומטית (לפח של ה־Shared Drive). המחיקה רצה רק אחרי שגיבוי חדש הועלה בהצלחה, כך שגם אם הגיבויים נכשלים במשך זמן רב, הגיבויים התקינים האחרונים לא יימחקו.
- **שחזור** בלחיצת כפתור ב־GitHub (פירוט בהמשך).

הכול רץ ב־GitHub Actions (`.github/workflows/db-backup.yml`, `db-restore.yml`). אם גיבוי נכשל, GitHub שולח מייל.

## מה נכלל בגיבוי

כל הטבלאות והנתונים של האפליקציה: סביבות, בורדים, קבוצות, משימות, דיווחי שעות, היסטוריית פעולות, משתמשים (profiles), קטלוג, רשימת התוצרים ודומיינים מורשים.

**לא נכלל:**
- תמונות פרופיל (נשמרות ב־Storage, לא במסד הנתונים). משתמש שהתמונה שלו תאבד יכול פשוט להעלות אותה מחדש.
- חשבונות ההתחברות עצמם (`auth.users`). אותם מנהל Supabase, והם נוצרים מחדש בהתחברות עם גוגל.

---

## הגדרה ראשונית (פעם אחת)

### 1. כתובת החיבור למסד הנתונים

1. ב־Supabase: לוחצים **Connect** בראש הדשבורד של הפרויקט.
2. בוחרים **Session pooler** (לא Direct connection, כי ה־Direct לא עובד מ־GitHub) ומעתיקים את ה־URI. הוא נראה בערך כך:
   `postgresql://postgres.fyiostdopgrivjgmzhxw:[YOUR-PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres`
3. מחליפים את `[YOUR-PASSWORD]` בסיסמת מסד הנתונים. אם היא לא ידועה, אפשר לאפס אותה ב־**Project Settings → Database → Reset database password**. האפליקציה עצמה לא משתמשת בסיסמה הזו, כך שהאיפוס לא ישבור אותה.

### 2. חשבון שירות בגוגל (Service Account)

1. נכנסים ל־[Google Cloud Console](https://console.cloud.google.com/) עם חשבון הסטודיו, ויוצרים פרויקט חדש (למשל `studio-backups`).
2. **APIs & Services → Library** ← מחפשים **Google Drive API** ← **Enable**.
3. **IAM & Admin → Service Accounts → Create service account**. נותנים שם (למשל `db-backup`), ולוחצים Done. אין צורך בהרשאות.
4. נכנסים לחשבון השירות שנוצר ← לשונית **Keys → Add key → Create new key → JSON**. קובץ JSON יורד למחשב. **שומרים אותו בסוד**, כי הוא מאפשר גישה לתיקיית הגיבויים.
5. מעתיקים את כתובת המייל של חשבון השירות (משהו כמו `db-backup@studio-backups.iam.gserviceaccount.com`).

> אם יצירת המפתח נחסמת עם הודעה על `iam.disableServiceAccountKeyCreation`, זו מדיניות ברירת מחדל של Google Workspace. מנהל ה־Workspace יכול לבטל אותה ב־**IAM & Admin → Organization Policies** עבור הפרויקט הזה בלבד.

### 3. Shared Drive בגוגל דרייב

חשבון שירות לא יכול לשמור קבצים ב"האחסון שלי" של משתמש רגיל, ולכן צריך **Shared Drive** (אחסון שיתופי).

1. בגוגל דרייב: **Shared drives → New**, ונותנים שם (למשל "גיבויי מערכת").
2. **Manage members** ← מוסיפים את המייל של חשבון השירות מסעיף 2 עם הרשאת **Content manager**.
3. נכנסים ל־Shared Drive ומעתיקים את ה־ID מכתובת הדפדפן: החלק שאחרי `/folders/`.

### 4. סודות ב־GitHub

ב־GitHub, במאגר: **Settings → Secrets and variables → Actions → New repository secret**. יוצרים שלושה:

| שם | ערך |
|---|---|
| `SUPABASE_DB_URL` | ה־URI מסעיף 1, כולל הסיסמה |
| `GDRIVE_SERVICE_ACCOUNT_JSON` | **כל התוכן** של קובץ ה־JSON מסעיף 2 (פותחים בעורך טקסט ומעתיקים הכול) |
| `GDRIVE_SHARED_DRIVE_ID` | ה־ID מסעיף 3 |

### 5. בדיקה

**Actions → DB backup → Run workflow**. אחרי דקה־שתיים אמור להופיע קובץ `studio-backup_<תאריך>_<שעה>.dump` בתיקייה `db-backups` ב־Shared Drive.

---

## שחזור

> **שחזור מחליף את כל הנתונים הנוכחיים** בנתונים מהגיבוי. כל מה שנוסף או שונה אחרי שעת הגיבוי יאבד.
> לפני השחזור נשמר אוטומטית עותק של המצב הנוכחי בתיקייה `db-backups/pre-restore`, כך שאפשר לבטל שחזור שנעשה בטעות.

1. ב־GitHub: **Actions → DB restore → Run workflow**.
2. **backup_file**: שם הקובץ מתיקיית הגיבויים בדרייב (למשל `studio-backup_2026-10-05_0623.dump`). משאירים ריק כדי לשחזר מהגיבוי האחרון.
3. **confirm**: מקלידים `RESTORE` (באנגלית, באותיות גדולות).
4. **Run workflow**.

השחזור רץ כפעולה אחת: אם משהו נכשל באמצע, שום דבר לא משתנה במסד הנתונים.

**ביטול שחזור:** מריצים שוב את **DB restore**, ובשדה `backup_file` כותבים `pre-restore/` ואחריו שם הקובץ מהתיקייה `pre-restore` (למשל `pre-restore/pre-restore_2026-10-05_1412.dump`).

### מצב קיצון: הפרויקט ב־Supabase נמחק לגמרי

1. יוצרים פרויקט Supabase חדש ומריצים בו את `supabase/schema.sql` (ומגדירים את Google OAuth לפי ה־README).
2. מעדכנים את הסוד `SUPABASE_DB_URL` לכתובת של הפרויקט החדש.
3. מריצים **DB restore** כרגיל.
