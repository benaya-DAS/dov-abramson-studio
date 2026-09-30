"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

// Mobile-only (flex md:hidden) counterpart to CollapsedSidebarLogo: the
// desktop sidebar is hidden entirely on mobile via CSS (see Sidebar.tsx),
// so the studio logo needs its own always-visible slot in TopBar there,
// with the same icon+text layout Sidebar.tsx's own header uses.
export default function MobileTopBarLogo() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      title="רענון הדף"
      className="flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 text-right md:hidden"
    >
      <Image
        src="/web-app-manifest-512x512.png"
        alt="סטודיו דוב אברמסון"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg object-contain"
      />
      <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">סטודיו דוב אברמסון</p>
    </button>
  );
}
