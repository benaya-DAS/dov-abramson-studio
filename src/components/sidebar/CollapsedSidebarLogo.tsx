"use client";

import Image from "next/image";
import { useSidebarState } from "./SidebarStateContext";

// Rendered inside TopBar's own header row - when the sidebar collapses
// down to its thin rail (see Sidebar.tsx), the logo would otherwise
// disappear entirely, so it reappears here instead, in the empty space
// right next to where the sidebar used to be. Clicking it reopens the
// sidebar, same as clicking the collapsed rail itself.
export default function CollapsedSidebarLogo() {
  const { collapsed, setCollapsed } = useSidebarState();

  if (!collapsed) return null;

  return (
    <button
      type="button"
      onClick={() => setCollapsed(false)}
      title="פתיחת הסיידבר"
      className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-night-800"
    >
      <Image
        src="/web-app-manifest-512x512.png"
        alt="סטודיו דוב אברמסון"
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-md object-contain"
      />
    </button>
  );
}
