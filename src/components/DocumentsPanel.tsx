"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { api, upload } from "@/lib/api";
import { errText, useStore } from "@/lib/store";
import type { Media } from "@/lib/types";
import { BlockLoader, ButtonSpinner } from "./ui/Spinner";

const DOC_TYPES = ["Constitution", "Certificate of registration (society / company)", "Minutes of the AGM / officials list", "Letter from the federation", "Other"];

/** Constitution and registration papers for clubs and organisations. `canEdit` is the owner only. */
export function DocumentsPanel({ applicationId, canEdit }: { applicationId: string; canEdit: boolean }) {
  const { refresh } = useStore();
  const [items, setItems] = useState<Media[] | null>(null);
  const [kind, setKind] = useState(DOC_TYPES[0]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ media: Media[] }>(`/applications/${applicationId}/media`)
      .then((r) => !cancelled && setItems(r.media.filter((m) => m.kind === "document")))
      .catch((e) => {
        if (cancelled) return;
        setErr(errText(e));
        setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, tick]);

  const send = async () => {
    const f = file.current?.files?.[0];
    if (!f) return setErr("Choose a PDF, JPG or PNG file.");
    if (f.size > 8 * 1024 * 1024) return setErr("That file is larger than 8 MB.");
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("kind", "document");
      fd.append("title", kind);
      fd.append("file", f);
      await upload(`/applications/${applicationId}/media`, fd);
      if (file.current) file.current.value = "";
      setTick((t) => t + 1);
      await refresh();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!items) return <BlockLoader label="Loading documents" />;
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="rounded-xl border border-line bg-bone p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <select className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">
              {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-forest-800 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-white" />
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">PDF, JPG or PNG up to 8 MB (max 6 files). Only you and the verifying officers can open them.</p>
          <button onClick={send} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-forest-950 disabled:opacity-70">
            {busy ? <ButtonSpinner /> : <Upload size={16} />} Upload document
          </button>
        </div>
      )}
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-kenya-red-deep">{err}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">No documents uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <a href={m.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-forest-800 hover:underline">
                <FileText size={17} className="shrink-0" /> <span className="truncate">{m.title || "Document"}</span>
                <span className="shrink-0 text-xs font-normal text-ink-3">{(m.size / 1048576).toFixed(1)} MB</span>
              </a>
              {canEdit && (
                <button aria-label="Delete document" onClick={async () => { if (confirm("Delete this document?")) { await fetch(`/api/media/${m.id}`, { method: "DELETE" }); setTick((t) => t + 1); refresh(); } }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-kenya-red hover:bg-red-50"><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
