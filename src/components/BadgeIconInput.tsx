"use client";

import { useRef, useState } from "react";
import { BadgeIcon } from "@/components/UserBadges";
import { btnGhost, inputCls } from "@/components/ui";

function resizeIcon(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 96;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Image processing unavailable"));
        const scale = Math.max(96 / image.width, 96 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (96 - width) / 2, (96 - height) / 2, width, height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function BadgeIconInput({ initial = "🏅" }: { initial?: string }) {
  const [icon, setIcon] = useState(initial);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input type="hidden" name="icon" value={icon} />
      <div className="flex items-center gap-2">
        <BadgeIcon badge={{ id: "preview", name: "Preview", description: "Badge preview", icon }} size={34} />
        <input
          value={icon.startsWith("data:image/") ? "" : icon}
          onChange={(event) => setIcon(event.target.value)}
          maxLength={12}
          placeholder="Emoji"
          aria-label="Badge emoji"
          className={`${inputCls} w-24`}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setError("");
            try { setIcon(await resizeIcon(file)); } catch { setError("Could not process that image."); }
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>Upload icon</button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[10px] text-ink-faint">Use an emoji or upload a square PNG, JPG, or WebP.</p>
    </div>
  );
}
