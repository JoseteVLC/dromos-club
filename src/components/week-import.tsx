"use client";

import { DateInput } from "./date-input";
import { useActionState, useState } from "react";
import { createWodsBulk, readWodPhotos } from "@/app/actions";
import { dayLabel } from "@/lib/dates";
import { parseWeek, type ParsedPart } from "@/lib/week-parser";
import { SCORE_TYPES, type ScoreType } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "./ui";
import { Icon } from "@/components/icon";

export function WeekImport({ defaultMonday, today }: { defaultMonday: string; today: string }) {
  const [monday, setMonday] = useState(defaultMonday);
  const [text, setText] = useState("");
  const [parts, setParts] = useState<ParsedPart[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [state, action] = useActionState(createWodsBulk, undefined);
  const { t, locale } = useI18n();
  const [fileMsg, setFileMsg] = useState("");
  const [photoDate, setPhotoDate] = useState(today);
  const [photoMsg, setPhotoMsg] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notes, setNotes] = useState("");

  // Reduce la foto en el móvil (lado largo 1600 px, JPEG) para subirla rápido
  const shrink = async (file: File) => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", 0.85));
      return new File([blob], "foto.jpg", { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const onPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    setNotes("");
    setPhotoMsg(t("Leyendo la foto con IA… (unos segundos)"));
    try {
      const fd = new FormData();
      fd.set("date", photoDate);
      for (const f of Array.from(files).slice(0, 4)) fd.append("photos", await shrink(f));
      const r = await Promise.race([
        readWodPhotos(fd),
        new Promise<{ error: string }>((res) => setTimeout(() => res({ error: "La IA está tardando demasiado. Prueba otra vez." }), 110000)),
      ]);
      if ("error" in r) {
        setPhotoMsg(t(r.error));
      } else {
        setParts(r.parts);
        setSkipped(0);
        setNotes(r.notes);
        setPhotoMsg(r.parts.length ? t("✓ He leído {n} parte(s). Revísalas abajo antes de crear.", { n: r.parts.length }) : t("No he encontrado WODs en la foto."));
      }
    } catch {
      setPhotoMsg(t("No he podido leer la foto. Prueba con otra más nítida."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const analyze = (t: string) => {
    const r = parseWeek(t, monday);
    setParts(r.parts);
    setSkipped(r.skipped);
  };

  // Word de la plani (.docx): sacamos el texto y lo analizamos directamente
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileMsg(t("Leyendo el Word…"));
    try {
      const mammoth = await import("mammoth/mammoth.browser");
      const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      const t = value.replace(/\u00a0/g, " ").replace(/\n\s*\n/g, "\n").trim();
      setText(t);
      setFileMsg(`✓ ${file.name}`);
      analyze(t);
    } catch {
      setFileMsg(t("No he podido leer ese archivo. Tiene que ser un Word (.docx); si no, copia y pega el texto."));
    }
  };

  // Mover todo lo leído a la semana que elijas (p. ej. cargar ya la semana que viene), manteniendo el día de cada parte
  const [moveTo, setMoveTo] = useState(defaultMonday);
  const mondayOf = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d;
  };
  const moveAll = () => {
    if (!parts?.length || !moveTo) return;
    const first = parts.map((p) => p.wod_date).sort()[0];
    const shift = Math.round((mondayOf(moveTo).getTime() - mondayOf(first).getTime()) / 864e5);
    if (!shift) return;
    setParts(
      parts.map((p) => {
        const d = new Date(p.wod_date + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() + shift);
        return { ...p, wod_date: d.toISOString().slice(0, 10) };
      }),
    );
  };

  const update = (key: string, patch: Partial<ParsedPart>) =>
    setParts((ps) => ps!.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const selected = parts?.filter((p) => p.include) ?? [];
  const missingType = selected.filter((p) => !p.score_type).length;

  return (
    <div className="space-y-4">
      <div className="card space-y-3 border-accent/40 p-4">
        <h2 className="h-display flex items-center gap-2 text-xl"><Icon name="camera" size={18} tile /> {t("Desde una foto")}</h2>
        <p className="text-xs text-muted">
          {t("Haz una foto a la pizarra del box, a la plani en papel o una captura de pantalla. La IA la lee y te prepara los WODs para revisar. Hasta 4 fotos a la vez.")}
        </p>
        <div>
          <label className="label" htmlFor="photo-date">{t("Fecha si la foto no indica el día")}</label>
          <DateInput id="photo-date" value={photoDate} onChange={setPhotoDate} />
        </div>
        <label className={`btn flex w-full cursor-pointer items-center justify-center gap-2 ${photoBusy ? "pointer-events-none opacity-60" : ""}`}>
          {photoBusy ? t("Leyendo…") : <span className="inline-flex items-center gap-2"><Icon name="camera" size={16} /> {t("Hacer foto o elegir imagen")}</span>}
          <input type="file" accept="image/*" multiple className="hidden" disabled={photoBusy} onChange={(e) => onPhotos(e.target.files)} />
        </label>
        {photoMsg && <p className="text-sm text-muted">{photoMsg}</p>}
        {notes && <p className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2 text-sm text-yellow-200"><Icon name="alert" size={14} /> {notes}</p>}
      </div>

      <div className="card space-y-4 p-4">
        <div>
          <label className="label" htmlFor="monday">{t("Semana que empieza el lunes (si el texto no trae fechas)")}</label>
          <DateInput id="monday" value={monday} onChange={setMonday} />
        </div>
        <div>
          <label className="label" htmlFor="docx">{t("Sube el Word de la plani…")}</label>
          <input
            id="docx"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="input text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1 file:font-semibold file:text-accent-fg"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {fileMsg && <p className="mt-1 text-xs text-muted">{fileMsg}</p>}
        </div>
        <div>
          <label className="label" htmlFor="week">{t("…o pega aquí la plani de la semana")}</label>
          <textarea
            id="week"
            rows={12}
            className="input font-mono text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"LUNES\nA) Back Squat\n5-5-3-3-1-1\nB) Metcon\nFor time: 21-15-9 ...\n\nMARTES\nAMRAP 12'\n..."}
          />
          <p className="mt-1 text-xs text-muted">
            {t("Vale el Word de la plani, el texto de TrueCoach o el del PDF, tal cual. Detecto días, partes (A, B, C…), quito calentamientos, accesorios y descansos (el trabajo «for quality» sí lo meto, para que apuntéis los pesos), y pongo el tipo de score si el texto lo dice. Si trae fechas («Mon, Nov 9») uso esas; si no, cuento desde el lunes de arriba.")}
          </p>
        </div>
        <button type="button" className="btn w-full" disabled={!text.trim() || !monday} onClick={() => analyze(text)}>
          {t("Analizar")}
        </button>
      </div>

      {parts && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="items" value={JSON.stringify(selected)} />
          <h2 className="h-display text-3xl">{t("Revisión · {n} partes", { n: parts.length })}</h2>
          {skipped > 0 && (
            <p className="text-sm text-muted">
              {t("He quitado {n} parte(s) sin leaderboard (calentamientos, vuelta a la calma y accesorios).", { n: skipped })}
            </p>
          )}
          {parts.length === 0 && <p className="card p-4 text-muted">{t("No he encontrado nada. Revisa el texto.")}</p>}
          {parts.length > 0 && (
            <div className="card flex flex-wrap items-end gap-2 p-3">
              <label className="min-w-0 flex-1">
                <span className="label">{t("Mover todo a la semana del lunes")}</span>
                <DateInput value={moveTo} onChange={setMoveTo} />
              </label>
              <button type="button" className="btn-ghost text-sm" onClick={moveAll}>
                {t("Mover")}
              </button>
              <p className="w-full text-xs text-muted">
                {t("Cada parte mantiene su día de la semana. Los atletas no ven una semana hasta el domingo anterior, así que puedes dejar cargada la siguiente.")}
              </p>
            </div>
          )}

          {parts.map((p) => (
            <div key={p.key} className={`card space-y-3 p-3 ${p.include ? "" : "opacity-40"}`}>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.include} onChange={(e) => update(p.key, { include: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                  <span className="font-semibold">{dayLabel(p.wod_date, undefined, t, locale)}</span>
                </label>
                <DateInput className="ml-auto w-44 text-sm" value={p.wod_date} onChange={(v) => update(p.key, { wod_date: v })} />
                <input
                  className="input w-12 py-1 text-center text-sm font-bold uppercase"
                  value={p.part}
                  maxLength={3}
                  onChange={(e) => update(p.key, { part: e.target.value.toUpperCase() })}
                />
              </div>
              {p.include && (
                <>
                  <input className="input" value={p.title} onChange={(e) => update(p.key, { title: e.target.value })} placeholder={t("Título")} />
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">{t("Ver / editar texto")}</summary>
                    <textarea
                      rows={6}
                      className="input mt-2 font-mono text-sm"
                      value={p.description}
                      onChange={(e) => update(p.key, { description: e.target.value })}
                    />
                  </details>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={`input w-auto py-1.5 text-sm ${p.score_type ? "" : "border-yellow-500 text-yellow-300"}`}
                      value={p.score_type}
                      onChange={(e) => update(p.key, { score_type: e.target.value as ScoreType })}
                    >
                      <option value="" disabled>
                        — {t("Elige tipo")} —
                      </option>
                      {(Object.keys(SCORE_TYPES) as ScoreType[]).map((st) => (
                        <option key={st} value={st}>
                          {t(SCORE_TYPES[st].label)}
                        </option>
                      ))}
                    </select>
                    {p.score_type === "for_time" && (
                      <input
                        className="input w-24 py-1.5 text-sm"
                        placeholder="Cap mm:ss"
                        value={p.time_cap}
                        onChange={(e) => update(p.key, { time_cap: e.target.value })}
                      />
                    )}
                    <label className="ml-auto flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={p.is_benchmark}
                        onChange={(e) => update(p.key, { is_benchmark: e.target.checked })}
                        className="size-4 accent-[var(--accent)]"
                      />
                      ★ Benchmark
                    </label>
                  </div>
                </>
              )}
            </div>
          ))}

          {parts.length > 0 && (
            <div className="sticky bottom-20 space-y-2 rounded-xl bg-bg/90 py-2 backdrop-blur">
              <FormMessage state={state} />
              {missingType > 0 && (
                <p className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
                  {t("Falta elegir el tipo de resultado en {n} parte(s) (en amarillo).", { n: missingType })}
                </p>
              )}
              <SubmitButton className={`w-full ${missingType ? "pointer-events-none opacity-40" : ""}`}>
                {t("Crear {n} WOD(s)", { n: selected.length })}
              </SubmitButton>
              <p className="text-center text-xs text-muted">{t("Desmarca lo que no quieras con leaderboard (calentamientos, accesorios…).")}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
