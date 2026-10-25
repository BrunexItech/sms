"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Star, Trash2, Upload, Video } from "lucide-react";
import { api, upload } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import type { Media } from "@/lib/types";
import { BlockLoader, ButtonSpinner } from "./ui/Spinner";

const MB = 1024 * 1024;

/** A player's profile photos and trial videos. `canEdit` is true only for the account that registered them. */
export function MediaPanel({ applicationId, canEdit }: { applicationId: string; canEdit: boolean }) {
  const { refresh, notify } = useStore();
  const [items, setItems] = useState<Media[] | null>(null);
  const [kind, setKind] = useState<"photo" | "video">("photo");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ media: Media[] }>(`/applications/${applicationId}/media`);
      setItems(r.media);
    } catch (e) {
      setErr(errText(e));
      setItems([]);
    }
  }, [applicationId]);

  useEffect(() => {
    let cancelled = false;
    api<{ media: Media[] }>(`/applications/${applicationId}/media`)
      .then((r) => !cancelled && setItems(r.media))
      .catch((e) => {
        if (cancelled) return;
        setErr(errText(e));
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const send = async () => {
    const f = file.current?.files?.[0];
    if (!f) return setErr(`Choose a ${kind === "photo" ? "photo" : "video"} first.`);
    const max = kind === "photo" ? 6 : 60;
    if (f.size > max * MB) return setErr(`That file is ${(f.size / MB).toFixed(1)} MB. The limit is ${max} MB.`);
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("title", title);
      fd.append("file", f);
      await upload(`/applications/${applicationId}/media`, fd);
      if (file.current) file.current.value = "";
      setTitle("");
      await Promise.all([load(), refresh()]);
      notify(`${f.name} (${(f.size / MB).toFixed(1)} MB) was added to your ${kind === "photo" ? "photos" : "trial videos"}.`, "ok", kind === "photo" ? "Photo uploaded" : "Video uploaded");
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setErr("");
    try {
      await fn();
      await Promise.all([load(), refresh()]);
    } catch (e) {
      setErr(errText(e));
    }
  };

  if (!items) return <BlockLoader label="Loading media" />;
  const photos = items.filter((m) => m.kind === "photo");
  const videos = items.filter((m) => m.kind === "video");

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-xl border border-line bg-bone p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-[150px_1fr]">
            <select className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value as "photo" | "video")} aria-label="Type">
              <option value="photo">Photo</option>
              <option value="video">Trial video</option>
            </select>
            <input className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" placeholder={kind === "photo" ? "Caption (optional)" : "What does this trial show? e.g. 40 m sprint, penalty drill"} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <input
            ref={file}
            type="file"
            accept={kind === "photo" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,video/webm"}
            className="mt-2.5 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-800 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-white"
          />
          <p className="mt-2 text-[11.5px] text-ink-3">
            Everything here is optional and never holds up verification; an officer may ask for a trial video if they need one. Photos: JPG, PNG or WebP up to 6 MB (max 8). Videos: MP4, MOV or WebM up to 60 MB (max 4). Only you and the verifying officers can see them.
          </p>
          <button onClick={send} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-forest-950 disabled:opacity-70">
            {busy ? <ButtonSpinner /> : <Upload size={16} />} {busy ? "Uploading…" : `Upload ${kind === "photo" ? "photo" : "video"}`}
          </button>
        </div>
      )}
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-kenya-red-deep">{err}</p>}

      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-forest-900"><Camera size={16} /> Photos ({photos.length})</h4>
        {photos.length === 0 ? (
          <p className="text-sm text-ink-3">No photos yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="relative aspect-square bg-bone">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.title || "Player photo"} className="h-full w-full object-cover" loading="lazy" />
                  {m.primary && <span className="absolute left-2 top-2 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-forest-950">PROFILE</span>}
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <span className="truncate text-xs text-ink-2">{m.title || "Photo"}</span>
                  {canEdit && (
                    <span className="flex shrink-0 gap-1">
                      {!m.primary && <button aria-label="Make profile photo" title="Make profile photo" onClick={() => act(() => api(`/media/${m.id}/primary`, "POST"))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-bone"><Star size={15} /></button>}
                      <button aria-label="Delete photo" title="Delete" onClick={() => confirm("Delete this photo?") && act(() => fetch(`/api/media/${m.id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error(); }))} className="grid h-8 w-8 place-items-center rounded-lg text-kenya-red hover:bg-red-50"><Trash2 size={15} /></button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-forest-900"><Video size={16} /> Trial videos ({videos.length})</h4>
        {videos.length === 0 ? (
          <p className="text-sm text-ink-3">No trial videos yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {videos.map((m) => (
              <li key={m.id} className="rounded-xl border border-line bg-white p-2.5">
                <video src={m.url} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
                <div className="mt-2 flex items-center justify-between gap-2 px-1">
                  <span className="min-w-0 truncate text-sm font-semibold">{m.title || "Trial video"}<span className="ml-2 text-xs font-normal text-ink-3">{(m.size / MB).toFixed(1)} MB</span></span>
                  {canEdit && <button aria-label="Delete video" onClick={() => confirm("Delete this video?") && act(() => fetch(`/api/media/${m.id}`, { method: "DELETE" }).then((r) => { if (!r.ok) throw new Error(); }))} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-kenya-red hover:bg-red-50"><Trash2 size={15} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
