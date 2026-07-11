"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

function resizeCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        const width = 960;
        const height = 540;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Image processing is unavailable"));
        const scale = Math.max(width / image.width, height / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function CoverPhotoInput({ name = "coverImageUrl" }: { name?: string }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) return setError("Choose a JPG, PNG, or WebP image.");
    try {
      setPreview(await resizeCover(file));
    } catch {
      setError("Could not process that photo.");
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={preview} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0])}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Banner preview" className="aspect-video w-full object-cover" />
          <button type="button" aria-label="Remove banner photo" onClick={() => setPreview("")} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white">
            <X size={17} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-1 text-sm font-medium text-ink-dim hover:border-accent hover:text-accent">
          <Camera size={18} /> Take or choose a banner photo
        </button>
      )}
      {preview && (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-10 items-center gap-2 text-xs font-semibold text-accent">
          <ImagePlus size={15} /> Replace photo
        </button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[10px] text-ink-faint">Auto-cropped to a 16:9 banner and compressed before upload.</p>
    </div>
  );
}
