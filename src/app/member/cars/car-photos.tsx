"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const BUCKET = "car-photos";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

export default function CarPhotos({ carId, initial }: { carId: string; initial: string[] }) {
  const [photos, setPhotos] = useState<string[]>(initial ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const added: string[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${carId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        added.push(`${base}${PUBLIC_PREFIX}${path}`);
      }
      const updated = [...photos, ...added];
      const { error: dbErr } = await supabase.from("cars").update({ photo_urls: updated }).eq("id", carId);
      if (dbErr) throw dbErr;
      setPhotos(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(url: string) {
    setBusy(true);
    setError(null);
    try {
      const idx = url.indexOf(PUBLIC_PREFIX);
      if (idx !== -1) {
        const path = url.slice(idx + PUBLIC_PREFIX.length);
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const updated = photos.filter((u) => u !== url);
      const { error: dbErr } = await supabase.from("cars").update({ photo_urls: updated }).eq("id", carId);
      if (dbErr) throw dbErr;
      setPhotos(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Photos</h2>
        <span className="text-xs text-slate-500">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Car" className="h-24 w-full object-cover rounded border border-slate-200" />
              <button
                type="button"
                onClick={() => remove(url)}
                disabled={busy}
                className="absolute top-1 right-1 rounded bg-black/60 text-white text-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="block">
        <span className="block text-sm font-medium mb-1">Add photos</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={onUpload}
          disabled={busy}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-brand file:text-white file:px-3 file:py-1.5 file:text-sm disabled:opacity-50"
        />
      </label>

      {busy && <p className="text-xs text-slate-500">Working…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Shown on the offer link and can be sent to renters over WhatsApp. Max 5 MB each (JPG/PNG/WebP).</p>
    </div>
  );
}
