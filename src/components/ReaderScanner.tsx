"use client";

import { useEffect, useState } from "react";
import { ScanLine, X } from "lucide-react";
import { api } from "@/lib/api";
import { errText } from "@/lib/store";
import { BlockLoader } from "./ui/Spinner";

async function toFile(image: unknown): Promise<File | null> {
  try {
    let blob: Blob | null = null;
    if (image instanceof Blob) blob = image;
    else if (typeof image === "string") blob = await (await fetch(image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`)).blob();
    return blob ? new File([blob], `scan-${new Date().toISOString().slice(0, 10)}.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type || "image/jpeg" }) : null;
  } catch {
    return null;
  }
}

/** The reader's own scanner (live camera, preview, extracted fields) shown inside our page. It hands back the image and fields. */
export function ReaderScanner({ docType, onResult, onClose }: { docType: "player" | "club"; onResult: (file: File, fields: unknown) => void; onClose: () => void }) {
  const [src, setSrc] = useState<{ url: string; origin: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let off = false;
    api<{ url: string; origin: string }>("/imports/reader/embed", "POST", { docType })
      .then((r) => !off && setSrc(r))
      .catch((e) => !off && setErr(errText(e)));
    return () => { off = true; };
  }, [docType]);

  useEffect(() => {
    if (!src) return;
    const on = async (e: MessageEvent) => {
      if (e.origin !== src.origin || e.data?.type !== "oqtekal-ocr-scan") return;
      const file = await toFile(e.data.image);
      if (!file) return setErr("The scan could not be read from the scanner. Try again or upload the file.");
      onResult(file, e.data.fields);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("message", on);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("message", on);
      document.removeEventListener("keydown", esc);
    };
  }, [src, onResult, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan a document" className="fixed inset-0 z-[80] grid place-items-center bg-forest-950/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="step-anim flex h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-forest-900"><ScanLine size={18} /> Scan a document</h2>
          <button onClick={onClose} aria-label="Close scanner" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-bone"><X size={18} /></button>
        </div>
        {err ? (
          <p role="alert" className="m-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-kenya-red-deep">{err}</p>
        ) : !src ? (
          <BlockLoader label="Opening the scanner" />
        ) : (
          <iframe title="Document scanner" src={src.url} allow="camera; microphone 'none'" className="min-h-0 w-full flex-1 border-0" />
        )}
      </div>
    </div>
  );
}
