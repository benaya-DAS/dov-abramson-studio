import UserMenu from "./UserMenu";
import { getCurrentProfile } from "@/lib/data";

export default async function TopBar() {
  const profile = await getCurrentProfile();

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5">
      <div className="flex-1" />
      <UserMenu profile={profile} />
    </header>
  );
}
