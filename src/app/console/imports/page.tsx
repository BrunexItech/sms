"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Check, FileScan, ScanLine, Trash2, RotateCw, Upload, X, ZoomIn, ZoomOut } from "lucide-react";
import { api, upload } from "@/lib/api";
import { SPORTS } from "@/data/sports";
import { errText, useStore } from "@/lib/store";
import { COMPETITION_LEVELS } from "@/lib/types";
import { Field, inputCls } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { BlockLoader, ButtonSpinner } from "@/components/ui/Spinner";
import { NoAccess, PageTitle } from "@/components/console/ui";
import { ReaderScanner } from "@/components/ReaderScanner";

interface Suggestion { value: string; confidence: number; script: string }
interface Rec {
  id: string; docType: "player" | "club"; status: string; fileName: string; mime: string; fields: Record<string, string>;
  cleaned: Record<string, string>; warnings: string[]; suggestions: Record<string, Suggestion>; reader: string; readerOn: boolean;
  applicationId: string | null; note: string; createdAt: string; scanDeleted: boolean; scanDeletedAt: string;
}

type Spec = { key: string; label: string; kind?: "text" | "select" | "sport" | "level"; options?: string[]; hint?: string; wide?: boolean };
const PLAYER: Spec[] = [
  { key: "name", label: "Full names", wide: true }, { key: "id_no", label: "ID or passport number" }, { key: "dob", label: "Date of birth", hint: "e.g. 15/04/1990" },
  { key: "gender", label: "Gender", kind: "select", options: ["Female", "Male"] }, { key: "kra", label: "KRA PIN" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
  { key: "sport", label: "Sport", kind: "sport" }, { key: "level", label: "Competition level", kind: "level" }, { key: "certificate_number", label: "Old certificate number" },
];
const GUARDIAN: Spec[] = [{ key: "guardian_name", label: "Parent or guardian" }, { key: "guardian_phone", label: "Guardian phone" }, { key: "guardian_relationship", label: "Relationship" }];
const CLUB: Spec[] = [
  { key: "club_name", label: "Club or organisation name", wide: true }, { key: "org_reg_no", label: "Registration number" }, { key: "sport", label: "Sport", kind: "sport" },
  { key: "name", label: "Contact person" }, { key: "id_no", label: "Contact person's ID" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
  { key: "chair_name", label: "Chairperson" }, { key: "chair_phone", label: "Chairperson phone" }, { key: "secretary_name", label: "Secretary" }, { key: "secretary_phone", label: "Secretary phone" },
  { key: "treasurer_name", label: "Treasurer" }, { key: "treasurer_phone", label: "Treasurer phone" }, { key: "certificate_number", label: "Old certificate number" },
];

export default function Page() {
  const { can, notify, admin } = useStore();
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [docType, setDocType] = useState<"player" | "club">("player");
  const [busy, setBusy] = useState("");
  const [scanning, setScanning] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useState(0);
  const [filter, setFilter] = useState<"Pending" | "Imported" | "Rejected">("Pending");
  const [reader, setReader] = useState<{ configured: boolean; ok: boolean; message: string } | null>(null);
  const [rule, setRule] = useState<{ auto: boolean; minConfidence: number; retentionDays: number; testDelete?: boolean } | null>(null);
  useEffect(() => {
    let off = false;
    api<{ auto: boolean; minConfidence: number; retentionDays: number }>("/imports/rule").then((r) => !off && setRule(r)).catch(() => {});
    return () => { off = true; };
  }, []);
  const setRetention = async (days: number) => {
    if (!rule) return;
    try {
      const r = await api<{ auto: boolean; minConfidence: number; retentionDays: number }>("/imports/rule", "PUT", { auto: rule.auto, minConfidence: rule.minConfidence, retentionDays: days });
      setRule(r);
      notify(r.retentionDays ? `Scans of finished records are deleted ${r.retentionDays} days later.` : "Scans of finished records are kept until someone deletes them.", "ok", "Scan retention changed");
    } catch (x) {
      notify(errText(x), "error", "Could not change retention");
    }
  };
  const deleteCompletely = async () => {
    if (!rec || !confirm("TESTING: delete this paper record completely?\n\nThis removes the scan, the record, and the registration made from it, so you can scan the same document again. It cannot be undone.")) return;
    setBusy("purge");
    try {
      await api(`/imports/${rec.id}`, "DELETE");
      setSel(null);
      await load();
      notify("Everything about this record is gone. You can scan the same document again.", "ok", "Deleted completely");
    } catch (x) {
      notify(errText(x), "error", "Could not delete");
    } finally {
      setBusy("");
    }
  };
  const deleteScan = async () => {
    if (!rec || !confirm("Delete this scan from the server? The information you approved stays in the registry, but the image cannot be recovered.")) return;
    setBusy("delete");
    try {
      await api(`/imports/${rec.id}/scan`, "DELETE");
      await load();
      notify("The image was removed from the server.", "ok", "Scan deleted");
    } catch (x) {
      notify(errText(x), "error", "Could not delete the scan");
    } finally {
      setBusy("");
    }
  };
  const toggleRule = async () => {
    if (!rule) return;
    try {
      const r = await api<{ auto: boolean; minConfidence: number; retentionDays: number }>("/imports/rule", "PUT", { auto: !rule.auto, minConfidence: rule.minConfidence, retentionDays: rule.retentionDays });
      setRule(r);
      notify(r.auto ? "Clear scans will be registered without a check." : "Every scan will now wait for an officer to approve it.", "ok", "Import rule changed");
    } catch (x) {
      notify(errText(x), "error", "Could not change the rule");
    }
  };
  useEffect(() => {
    let off = false;
    api<{ configured: boolean; ok: boolean; message: string }>("/imports/reader/status").then((r) => !off && setReader(r)).catch(() => {});
    return () => { off = true; };
  }, []);

  const load = useCallback(async () => {
    const r = await api<{ imports: Rec[] }>("/imports");
    setRows(r.imports);
    return r.imports;
  }, []);
  useEffect(() => {
    let off = false;
    api<{ imports: Rec[] }>("/imports").then((r) => !off && setRows(r.imports)).catch(() => !off && setRows([]));
    return () => { off = true; };
  }, []);

  const rec = rows?.find((r) => r.id === sel) ?? null;
  const open = (r: Rec) => { setSel(r.id); setDraft(r.fields); setWarnings(r.warnings); setZoom(1); setTurn(0); };
  const shown = useMemo(() => (rows ?? []).filter((r) => r.status === filter), [rows, filter]);

  if (!can("applications.review")) return <NoAccess need="applications.review" />;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    return processFiles(files);
  };
  const processFiles = async (files: File[], scanned?: string) => {
    if (!files.length) return;
    setBusy("upload");
    let auto = 0, check = 0, failed = 0;
    let firstPending: string | null = null;
    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append("doc_type", docType);
        fd.append("file", f);
        if (scanned) fd.append("scanned", scanned);
        const r = await upload<{ import: Rec; autoImported: boolean }>("/imports", fd);
        if (r.autoImported) auto++;
        else { check++; firstPending ??= r.import.id; }
      } catch (x) {
        failed++;
        notify(`${f.name}: ${errText(x)}`, "error", "Upload failed");
      }
    }
    const list = await load();
    if (auto) setFilter("Imported");
    if (firstPending) { setFilter("Pending"); const m = list.find((x) => x.id === firstPending); if (m) open(m); }
    const parts = [auto && `${auto} registered automatically`, check && `${check} need${check === 1 ? "s" : ""} a quick check`, failed && `${failed} failed`].filter(Boolean).join(", ");
    if (auto || check) notify(`${parts}.${auto ? " Registered records still go through normal verification." : ""}`, "ok", files.length === 1 ? "Scan processed" : `${files.length} scans processed`);
    setBusy("");
  };

  const save = async () => {
    if (!rec) return null;
    const r = await api<{ import: Rec }>(`/imports/${rec.id}`, "PUT", { fields: draft });
    setWarnings(r.import.warnings);
    setRows((rs) => rs?.map((x) => (x.id === r.import.id ? r.import : x)) ?? rs);
    return r.import;
  };
  const run = async (kind: "save" | "import" | "reject") => {
    if (!rec) return;
    setBusy(kind);
    try {
      if (kind === "reject") {
        const note = prompt("Why is this paper record not being imported?") ?? "";
        if (note.trim().length < 3) return;
        await api(`/imports/${rec.id}/reject`, "POST", { note });
        notify("The paper record was set aside.", "ok", "Rejected");
      } else {
        await save();
        if (kind === "save") notify("Your changes were saved. Come back to finish it any time.", "ok", "Draft saved");
        else {
          const r = await api<{ applicationId: string }>(`/imports/${rec.id}/import`, "POST");
          notify(`It is now registration ${r.applicationId} and goes through normal verification.`, "ok", "Approved and registered");
        }
      }
      if (kind !== "save") { setSel(null); await load(); }
    } catch (x) {
      notify(errText(x), "error", kind === "import" ? "Could not import" : "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const county = admin.counties.find((c) => c.n === draft.county);
  const sub = county?.s.find((s) => s.n === draft.sub_county);
  const minor = rec?.docType === "player" && /^\d{4}-/.test(rec.cleaned.dob ?? "") && new Date().getFullYear() - Number(rec.cleaned.dob.slice(0, 4)) < 18;
  const specs = rec ? (rec.docType === "player" ? [...PLAYER.slice(0, 8), ...(minor ? GUARDIAN : []), ...PLAYER.slice(8)] : CLUB) : [];
  const editable = rec?.status === "Pending";

  const input = (s: Spec) => {
    const sug = rec?.suggestions[s.key];
    return (
      <Field key={s.key} label={s.label} hint={s.hint} className={s.wide ? "sm:col-span-2" : undefined}>
        {s.kind === "select" || s.kind === "level" ? (
          <select className={inputCls} value={draft[s.key] ?? ""} onChange={(e) => set(s.key, e.target.value)} disabled={!editable}>
            <option value="">Select</option>
            {(s.kind === "level" ? [...COMPETITION_LEVELS] : s.options ?? []).map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : s.kind === "sport" ? (
          <select className={inputCls} value={SPORTS.find((x) => x.id === draft.sport || x.name.toLowerCase() === (draft.sport ?? "").toLowerCase())?.id ?? draft.sport ?? ""} onChange={(e) => set(s.key, e.target.value)} disabled={!editable}>
            <option value="">Select a sport</option>
            {SPORTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        ) : (
          <input className={inputCls} value={draft[s.key] ?? ""} onChange={(e) => set(s.key, e.target.value)} disabled={!editable} />
        )}
        {sug?.value && sug.value !== draft[s.key] && editable && (
          <button type="button" onClick={() => set(s.key, sug.value)} className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold ${sug.confidence < 0.7 ? "bg-gold-soft text-forest-900" : "bg-forest-100 text-forest-800"}`}>
            Reader: “{sug.value}” ({Math.round(sug.confidence * 100)}%{sug.script === "handwritten" ? ", handwriting" : ""}) · use
          </button>
        )}
      </Field>
    );
  };

  return (
    <>
      {scanning && <ReaderScanner docType={docType} onClose={() => setScanning(false)} onResult={(file, fields) => { setScanning(false); processFiles([file], JSON.stringify(fields ?? [])); }} />}
      <PageTitle title="Paper records" sub="Scan old forms, check each field against the image, then import them as registrations. Nothing is registered until you press Import." />

      <section className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <label className="text-sm font-semibold">Form type
          <select className={`${inputCls} mt-1 min-w-[180px]`} value={docType} onChange={(e) => setDocType(e.target.value as "player" | "club")}>
            <option value="player">Player registration</option>
            <option value="club">Club registration</option>
          </select>
        </label>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-forest-800 px-4 py-3 text-sm font-bold text-white hover:bg-forest-900 ${busy === "upload" ? "pointer-events-none opacity-70" : ""}`}>
          {busy === "upload" ? <ButtonSpinner /> : <Upload size={16} />} Upload scans
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={pick} />
        </label>
        <button type="button" onClick={() => setScanning(true)} disabled={busy === "upload"} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold text-forest-950 hover:brightness-105 disabled:opacity-70">
          <ScanLine size={16} /> Scan with the reader
        </button>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-forest-800 px-4 py-3 text-sm font-bold text-forest-800 hover:bg-forest-100 ${busy === "upload" ? "pointer-events-none opacity-70" : ""}`}>
          <Camera size={16} /> Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
        </label>
        <p className="text-xs text-ink-3">Choose one or many files (JPG, PNG, WebP or PDF, up to 12 MB each, one form per file). The fields are read from each scan; you check them beside the image and press Approve. Scans are private.</p>
        {rule && (
          <button type="button" onClick={toggleRule} disabled={!can("settings.manage")} aria-pressed={rule.auto} title={can("settings.manage") ? "Switch automatic registration on or off" : "Only an administrator can change this"} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${rule.auto ? "bg-leaf/15 text-leaf" : "bg-bone text-ink-2"}`}>
            <span aria-hidden className={`relative h-4 w-7 rounded-full transition ${rule.auto ? "bg-leaf" : "bg-ink-3/50"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${rule.auto ? "left-3.5" : "left-0.5"}`} /></span>
            Skip the check for clear scans: {rule.auto ? `on (${Math.round(rule.minConfidence * 100)}%+)` : "off"}
          </button>
        )}
        {rule && (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-2">
            Delete scans after
            <select className="rounded-md border border-line bg-white px-2 py-1.5 text-xs font-bold" value={rule.retentionDays} disabled={!can("settings.manage")} onChange={(e) => setRetention(Number(e.target.value))} aria-label="Scan retention">
              <option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={0}>never</option>
            </select>
          </label>
        )}
        {reader && (
          <span title={reader.message} className={`ml-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${reader.ok ? "bg-leaf/15 text-leaf" : "bg-bone text-ink-2"}`}>
            <span aria-hidden className={`h-2 w-2 rounded-full ${reader.ok ? "bg-leaf" : "bg-ink-3"}`} /> {reader.ok ? "Reader connected" : "Reader off: keying by hand"}
          </span>
        )}
      </section>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["Pending", "Imported", "Rejected"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s} className={`rounded-lg px-3.5 py-2 text-sm font-bold ${filter === s ? "bg-forest-800 text-white" : "bg-white text-ink-2 ring-1 ring-line hover:bg-bone"}`}>
            {s} ({(rows ?? []).filter((r) => r.status === s).length})
          </button>
        ))}
      </div>

      {!rows ? <BlockLoader label="Loading paper records" /> : (
        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
            {shown.map((r) => (
              <li key={r.id}>
                <button onClick={() => open(r)} aria-current={sel === r.id} className={`flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-forest-700/50 ${sel === r.id ? "border-forest-700" : "border-line"}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-forest-100 text-forest-800"><FileScan size={18} /></span>
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.cleaned.club_name || r.cleaned.name || r.fileName}</b><span className="text-xs text-ink-3">{r.docType === "player" ? "Player" : "Club"} · {new Date(r.createdAt).toLocaleDateString("en-KE")}{r.status === "Imported" && r.note === "automatically" ? " · automatic" : ""}{r.status === "Pending" && r.note ? " · needs a check" : ""}</span></span>
                  <Pill>{r.status}</Pill>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-ink-3">No {filter.toLowerCase()} paper records.</li>}
          </ul>

          {rec ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <section className="min-w-0 rounded-2xl border border-line bg-white p-3 lg:sticky lg:top-24">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{rec.fileName}</p>
                  {rule?.testDelete && can("settings.manage") && (
                    <button onClick={deleteCompletely} disabled={busy === "purge"} title="Testing only: delete the scan, the record and the registration made from it" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-kenya-red px-2.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"><Trash2 size={14} /> Delete completely</button>
                  )}
                  {!rec.scanDeleted && (
                    <div className="flex gap-1.5">
                      <button onClick={deleteScan} disabled={busy === "delete"} aria-label="Delete scan" title="Delete this scan from the server" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-kenya-red hover:bg-red-50 disabled:opacity-60"><Trash2 size={15} /></button>
                    </div>
                  )}
                  {rec.mime.startsWith("image/") && !rec.scanDeleted && (
                    <div className="flex gap-1.5">
                      <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Zoom out" className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-bone"><ZoomOut size={15} /></button>
                      <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Zoom in" className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-bone"><ZoomIn size={15} /></button>
                      <button onClick={() => setTurn((t) => (t + 90) % 360)} aria-label="Rotate" className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:bg-bone"><RotateCw size={15} /></button>
                    </div>
                  )}
                </div>
                <div className="max-h-[72vh] overflow-auto rounded-xl bg-bone">
                  {rec.scanDeleted ? (
                    <p className="grid min-h-[260px] place-items-center p-6 text-center text-sm font-semibold text-ink-3">This scan was deleted{rec.scanDeletedAt ? ` on ${new Date(rec.scanDeletedAt).toLocaleDateString("en-KE")}` : ""}. The registration keeps the approved information.</p>
                  ) : rec.mime === "application/pdf" ? (
                    <iframe title="Scanned form" src={`/api/imports/${rec.id}/image`} className="h-[70vh] w-full" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/imports/${rec.id}/image`} alt="Scanned paper form" style={{ width: `${zoom * 100}%`, transform: `rotate(${turn}deg)`, transformOrigin: "center" }} className="max-w-none" />
                  )}
                </div>
              </section>

              <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
                <h2 className="text-base font-bold text-forest-900">Information read from the document</h2>
                {(() => {
                  const sug = Object.values(rec.suggestions);
                  const low = sug.filter((x) => x.confidence < 0.8).length;
                  return rec.readerOn ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <span className="rounded-full bg-leaf/15 px-2.5 py-1 font-bold text-leaf">{sug.length} fields read</span>
                      {low > 0 && <span className="rounded-full bg-gold-soft px-2.5 py-1 font-bold text-forest-900">{low} to double-check</span>}
                      Compare with the scan, correct anything, then press Approve.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-3">{rec.reader || "Type each value as it appears on the paper. Phone numbers, dates and IDs are tidied automatically."}</p>
                  );
                })()}
                {rec.status === "Imported" && <p className="mt-3 rounded-lg bg-leaf/10 px-3 py-2 text-sm font-semibold text-leaf">Imported as registration {rec.applicationId}.</p>}
                {rec.status === "Rejected" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-kenya-red-deep">Set aside: {rec.note}</p>}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {specs.filter((s) => s.key !== "certificate_number" && !["chair_name", "chair_phone", "secretary_name", "secretary_phone", "treasurer_name", "treasurer_phone"].includes(s.key)).map(input)}

                  <Field label="County"><select className={inputCls} value={draft.county ?? ""} disabled={!editable} onChange={(e) => setDraft((d) => ({ ...d, county: e.target.value, sub_county: "", ward: "" }))}>
                    <option value="">Select county</option>{admin.counties.map((c) => <option key={c.id}>{c.n}</option>)}</select></Field>
                  <Field label="Sub-county"><select className={inputCls} value={draft.sub_county ?? ""} disabled={!editable || !county} onChange={(e) => setDraft((d) => ({ ...d, sub_county: e.target.value, ward: "" }))}>
                    <option value="">Select sub-county</option>{county?.s.map((s) => <option key={s.id}>{s.n}</option>)}</select></Field>
                  <Field label="Ward"><select className={inputCls} value={draft.ward ?? ""} disabled={!editable || !sub} onChange={(e) => set("ward", e.target.value)}>
                    <option value="">Select ward</option>{sub?.w.map((w) => <option key={w.id}>{w.n}</option>)}</select></Field>

                  {rec.docType === "club" && (
                    <fieldset className="grid gap-4 rounded-xl border border-line bg-bone p-3 sm:col-span-2 sm:grid-cols-2">
                      <legend className="px-2 text-[13px] font-semibold">Officials</legend>
                      {specs.filter((s) => ["chair_name", "chair_phone", "secretary_name", "secretary_phone", "treasurer_name", "treasurer_phone"].includes(s.key)).map(input)}
                    </fieldset>
                  )}
                  {specs.filter((s) => s.key === "certificate_number").map(input)}
                </div>

                {warnings.length > 0 && editable && (
                  <ul className="mt-4 space-y-1 rounded-lg border border-gold bg-gold-soft p-3 text-[13px] text-forest-900">
                    {warnings.map((w) => <li key={w}>• {w}</li>)}
                  </ul>
                )}
                {editable && (
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    <button onClick={() => run("import")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-leaf px-5 py-3 text-sm font-bold text-white disabled:opacity-70">{busy === "import" ? <ButtonSpinner /> : <Check size={16} />} Approve and register</button>
                    <button onClick={() => run("save")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-3 text-sm font-bold text-forest-800 hover:bg-bone disabled:opacity-70">{busy === "save" ? <ButtonSpinner /> : null} Save draft</button>
                    <button onClick={() => run("reject")} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-kenya-red-deep hover:bg-red-100 disabled:opacity-70"><X size={16} /> Set aside</button>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-3">Upload a scan, or choose a paper record from the list, to check it here.</p>
          )}
        </div>
      )}
    </>
  );
}
