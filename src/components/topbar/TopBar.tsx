import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import CollapsedSidebarLogo from "@/components/sidebar/CollapsedSidebarLogo";
import { getCurrentProfile } from "@/lib/data";

export default async function TopBar() {
  const profile = await getCurrentProfile();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 dark:border-night-700 dark:bg-night-900">
      {/* This flex-1 spacer is the RIGHTMOST part of the header under
       * dir="rtl" (first DOM child = layout start = right edge) - exactly
       * where the sidebar's own header sits when it's open, so the logo
       * reappearing here when the sidebar collapses reads as it "moving
       * over" rather than vanishing. */}
      <div className="flex flex-1 items-center">
        <CollapsedSidebarLogo />
      </div>
      {/* JSX order sets visual position under dir="rtl": UserMenu (avatar)
       * comes first here so it sits closer to center, ThemeToggle after it
       * so it lands as the leftmost element, right beside the avatar - "top
       * bar, left side, next to the profile area" per the design spec. */}
      <UserMenu profile={profile} />
      <ThemeToggle />
    </header>
  );
}
