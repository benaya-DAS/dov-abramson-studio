import CreateFirstWorkspaceForm from "@/components/CreateFirstWorkspaceForm";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-panel dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl dark:bg-brand-900/40">
          🗂️
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">ברוכים הבאים לסטודיו דוב אברמסון</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          עדיין לא הוגדרה אף מחלקה במערכת. צרו את המחלקה הראשונה למטה, או הריצו את הקובץ{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-700">supabase/seed.sql</code> כדי
          לטעון את מבנה המחלקות והלוחות לדוגמה.
        </p>
        <CreateFirstWorkspaceForm />
      </div>
    </main>
  );
}
