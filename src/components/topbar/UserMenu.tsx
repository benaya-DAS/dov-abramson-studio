"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";
import FloatingPanel from "@/components/ui/FloatingPanel";

export default function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!profile) return null;

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1 hover:bg-slate-50"
      >
        <Avatar profile={profile} size={28} />
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">
          {profile.full_name || profile.email}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <FloatingPanel
            anchorRef={buttonRef}
            align="end"
            className="z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {profile.full_name}
              </p>
              <p className="truncate text-xs text-slate-500">{profile.email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              התנתקות
            </button>
          </FloatingPanel>
        </>
      )}
    </div>
  );
}

export function Avatar({
  profile,
  size = 24,
}: {
  profile: Pick<Profile, "full_name" | "email" | "avatar_url"> | null;
  size?: number;
}) {
  if (!profile) {
    return (
      <span
        style={{ width: size, height: size }}
        className="inline-flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-500"
      >
        ?
      </span>
    );
  }

  if (profile.avatar_url) {
    return (
      <Image
        src={profile.avatar_url}
        alt={profile.full_name || profile.email}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700"
      title={profile.full_name || profile.email}
    >
      {initials(profile.full_name, profile.email)}
    </span>
  );
}
