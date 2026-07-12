"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Download, Lock, Trash2, X } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { formatDateLabel } from "@/lib/utils";

type Photo = { id: string; width: number | null; height: number | null };
export type PhotoGroup = { entryDate: string; hasMeasurements: boolean; photos: Photo[] };

export function ProgressPhotosExperience({ groups, today }: { groups: PhotoGroup[]; today: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(today);
  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [earlier, setEarlier] = useState(groups.at(-1)?.entryDate ?? "");
  const [later, setLater] = useState(groups[0]?.entryDate ?? "");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const groupFor = (value: string) => groups.find((group) => group.entryDate === value);
  const selectedPhoto = (value: string) => {
    const group = groupFor(value);
    return group?.photos.find((photo) => photo.id === selected[value]) ?? group?.photos[0];
  };

  function choose(list: FileList | null) {
    files.forEach(({ url }) => URL.revokeObjectURL(url));
    const all = Array.from(list ?? []);
    setError(all.length > 4 ? "You can upload up to 4 photos at a time." : "");
    setFiles(all.slice(0, 4).map((file) => ({ file, url: URL.createObjectURL(file) })));
  }
  function removePreview(index: number) {
    setFiles((current) => current.filter((item, i) => { if (i === index) URL.revokeObjectURL(item.url); return i !== index; }));
  }
  function upload() {
    if (!files.length) return setError("Choose at least one photo.");
    setError(""); setProgress(0);
    const body = new FormData(); body.set("entryDate", date); files.forEach(({ file }) => body.append("files", file));
    const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/progress/photos");
    xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round(event.loaded / event.total * 100));
    xhr.onload = () => {
      let data: { error?: string } = {}; try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        files.forEach(({ url }) => URL.revokeObjectURL(url)); setFiles([]); if (inputRef.current) inputRef.current.value = "";
        setProgress(null); router.refresh();
      } else { setError(data.error ?? "Upload failed."); setProgress(null); }
    };
    xhr.onerror = () => { setError("Upload failed. Check your connection and try again."); setProgress(null); };
    xhr.send(body);
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this progress photo? This cannot be undone.")) return;
    setDeleting(id); setError("");
    const response = await fetch(`/api/progress/photos/${id}`, { method: "DELETE" });
    if (!response.ok) setError((await response.json().catch(() => ({}))).error ?? "Delete failed."); else router.refresh();
    setDeleting(null);
  }

  return <div className="space-y-4">
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Add photos</h2>
      <p className="mb-3 text-[11px] text-ink-faint">Use consistent lighting, distance, and angles for easier comparisons.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-ink-dim">Progress date<Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black"><Camera size={16}/> Camera or gallery
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => choose(e.target.files)} />
        </label>
      </div>
      {files.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{files.map(({ file, url }, index) => <div key={`${file.name}-${file.lastModified}`} className="relative aspect-square overflow-hidden rounded-lg bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Selected photo ${index + 1}`} className="h-full w-full object-cover" />
        <button type="button" onClick={() => removePreview(index)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white" aria-label={`Remove selected photo ${index + 1}`}><X size={14}/></button>
      </div>)}</div>}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {progress != null && <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full bg-accent" style={{ width: `${progress}%` }}/></div><p className="mt-1 text-[10px] text-ink-faint">Uploading {progress}%</p></div>}
      {files.length > 0 && <Button type="button" className="mt-3" disabled={progress != null} onClick={upload}>Upload {files.length} photo{files.length === 1 ? "" : "s"}</Button>}
    </Card>

    {groups.length ? <section className="space-y-3"><div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold">Your timeline</h2><span className="text-[10px] text-ink-faint">Newest first</span></div>
      {groups.map((group) => <Card key={group.entryDate} className="p-4"><div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-semibold">{formatDateLabel(group.entryDate)}</h3><p className="text-[10px] text-ink-faint">{group.photos.length} photo{group.photos.length === 1 ? "" : "s"}{group.hasMeasurements ? " · measurements recorded" : ""}</p></div><Lock size={14} className="text-accent" aria-label="Private"/></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{group.photos.map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-edge bg-surface"><a href={`/api/progress/photos/${photo.id}`} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/progress/photos/${photo.id}`} alt={`Progress on ${formatDateLabel(group.entryDate)}`} className="aspect-[3/4] w-full object-cover" /></a><div className="flex justify-center gap-1 p-1"><a className="rounded p-1.5 text-ink-dim hover:text-accent" href={`/api/progress/photos/${photo.id}?download=1`} aria-label="Download photo"><Download size={15}/></a><button className="rounded p-1.5 text-ink-dim hover:text-danger disabled:opacity-50" disabled={deleting === photo.id} onClick={() => remove(photo.id)} aria-label="Delete photo"><Trash2 size={15}/></button></div></div>)}</div>
      </Card>)}</section> : <div className="rounded-xl border border-dashed border-edge py-12 text-center"><Lock className="mx-auto mb-2 text-accent"/><h2 className="text-sm font-semibold">Your photos stay private</h2><p className="mx-auto mt-1 max-w-xs text-xs text-ink-faint">Only you can view or download progress photos. Add your first photo from your camera or gallery above.</p><Button className="mt-3" onClick={() => inputRef.current?.click()}>Choose photos</Button></div>}

    {groups.length >= 2 && <Card className="p-4"><h2 className="text-sm font-semibold">Compare progress</h2><p className="mb-3 text-[11px] text-ink-faint">Choose two dates, then select a photo from each day.</p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{[["Earlier", earlier, setEarlier], ["Later", later, setLater]].map(([label, value, setter]) => <label key={label as string} className="text-xs text-ink-dim">{label as string}<select className="mt-1 w-full rounded-lg border border-edge bg-surface px-3 py-2" value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}>{groups.map((g) => <option key={g.entryDate} value={g.entryDate}>{formatDateLabel(g.entryDate)}</option>)}</select></label>)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[earlier, later].map((value, column) => { const photo = selectedPhoto(value); const group = groupFor(value); return <div key={`${column}-${value}`}><p className="mb-1 text-center text-xs font-medium">{formatDateLabel(value)}</p>{photo && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/progress/photos/${photo.id}`} alt={`${column ? "Later" : "Earlier"} progress`} className="aspect-[3/4] w-full rounded-lg bg-surface object-cover"/><div className="mt-2 flex gap-1 overflow-x-auto">{group?.photos.map((item) => <button key={item.id} onClick={() => setSelected((current) => ({ ...current, [value]: item.id }))} className={`shrink-0 overflow-hidden rounded border-2 ${photo.id === item.id ? "border-accent" : "border-transparent"}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/progress/photos/${item.id}`} alt="Select comparison photo" className="h-14 w-11 object-cover"/></button>)}</div></>}</div>})}</div>
    </Card>}
  </div>;
}
