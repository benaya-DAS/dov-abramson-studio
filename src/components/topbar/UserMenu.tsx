"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { blurActiveElement, initials } from "@/lib/utils";
import { useEscapeKey } from "@/lib/useEscapeKey";
import type { Profile } from "@/lib/supabase/types";
import FloatingPanel from "@/components/ui/FloatingPanel";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  // Optimistic override so the new picture shows immediately, rather than
  // waiting on router.refresh() to re-run the server component that fetches
  // `profile` - avatar_url itself changes (a fresh timestamped path, see
  // handleAvatarChange) so there's no stale-cache risk in showing it right
  // away.
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function close() {
    blurActiveElement();
    setOpen(false);
  }

  useEscapeKey(close, open);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !profile) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("יש לבחור קובץ תמונה.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError("התמונה גדולה מדי (מקסימום 5MB).");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    // Timestamped path (not a fixed "avatar.<ext>") so the public URL
    // itself changes on every upload - storage's public URLs can be
    // cached at the CDN edge, and a stable path could keep serving the
    // old image for a while after a re-upload.
    const ext = file.type.split("/")[1] || "jpg";
    const path = `${profile.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });

    if (uploadErr) {
      console.error("Failed to upload avatar:", uploadErr);
      setUploadError(`העלאת התמונה נכשלה: ${uploadErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", profile.id);

    if (updateErr) {
      console.error("Failed to save avatar URL:", updateErr);
      setUploadError(`שמירת התמונה נכשלה: ${updateErr.message}`);
      setUploading(false);
      return;
    }

    setAvatarOverride(urlData.publicUrl);
    setUploading(false);
    router.refresh();
  }

  if (!profile) return null;

  const displayedProfile = avatarOverride ? { ...profile, avatar_url: avatarOverride } : profile;

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-3 pr-1 hover:bg-slate-50 dark:border-night-700 dark:hover:bg-night-800"
      >
        <Avatar profile={displayedProfile} size={28} />
        <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {profile.full_name || profile.email}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <FloatingPanel
            anchorRef={buttonRef}
            align="end"
            className="z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-night-700 dark:bg-night-800"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="העלאת תמונת פרופיל"
                className="group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
              >
                <Avatar profile={displayedProfile} size={44} />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <Camera size={16} />
                </span>
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {profile.full_name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {uploading && (
              <p className="px-3 pb-1 text-xs text-slate-400 dark:text-slate-500">מעלה תמונה...</p>
            )}
            {uploadError && (
              <p className="px-3 pb-1 text-xs text-red-500 dark:text-red-400">{uploadError}</p>
            )}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
        className="inline-flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-500 dark:bg-night-700 dark:text-slate-400"
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
      className="inline-flex items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300"
      title={profile.full_name || profile.email}
    >
      {initials(profile.full_name, profile.email)}
    </span>
  );
}
