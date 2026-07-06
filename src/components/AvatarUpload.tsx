"use client";

import { useActionState, useRef, useState } from "react";
import { updateAvatar } from "@/actions/onboarding";
import { Avatar, btnPrimary, btnGhost } from "./ui";

// Resize any picked image to a square ~256px JPEG data URL so the stored payload
// stays tiny (no external media pipeline yet — see updateAvatar).
function resizeToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        // cover-crop to a centered square
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  displayName,
  currentAvatar,
}: {
  displayName: string;
  currentAvatar: string | null;
}) {
  const [state, action, pending] = useActionState(updateAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(currentAvatar);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeToDataUrl(file);
      setPreview(dataUrl);
    } catch {
      setError("Couldn't process that image.");
    }
  }

  return (
    <form action={action} className="flex items-center gap-4">
      <Avatar name={displayName} size={64} src={preview} />
      <input type="hidden" name="avatar" value={preview ?? ""} />
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} className="hidden" />
      <div className="space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>
            Choose photo
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className={btnGhost}
            >
              Remove
            </button>
          )}
          <button disabled={pending} className={btnPrimary}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {state?.error && <p className="text-xs text-danger">{state.error}</p>}
        {state?.ok && !error && <p className="text-xs text-accent">Saved ✓</p>}
        <p className="text-[10px] text-ink-faint">PNG, JPG, or WebP — auto-cropped to a square.</p>
      </div>
    </form>
  );
}
