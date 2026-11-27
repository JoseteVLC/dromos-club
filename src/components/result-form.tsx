"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { TIMER_EVENT, type TimerResult } from "./wod-timer";
import { twoDigits } from "@/lib/scoring";
import { saveResult } from "@/app/actions";
import { formatTime } from "@/lib/scoring";
import { DIVISIONS, SCORE_TYPES, wodDivisions, type Division, type Result, type Wod } from "@/lib/types";
import { FormMessage, Segmented } from "./ui";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

/** single: modo competición, una sola versión (sin Élite/RX/Escalado); si han escalado algo, lo cuentan en las notas. */
export function ResultForm({ wod, existing, defaultDivision, single: singleProp = false, prNote }: { wod: Wod; existing: Result | null; defaultDivision?: Division; single?: boolean; prNote?: string }) {
  const [state, action, pending] = useActionState(saveResult, undefined);
  // Se envía a mano para que el formulario no se vacíe si hay que confirmar o corregir algo
  const last = useRef<FormData | null>(null);
  const send = (fd: FormData) => {
    last.current = fd;
    startTransition(() => action(fd));
  };
  // Pesos (1RM, 3RM, cargas…): marca absoluta, sin Élite / RX / Escalado, como en el modo competición
  const single = singleProp || wod.score_type === "load";
  const { t } = useI18n();
  const [finished, setFinished] = useState<"yes" | "no">(existing && !existing.finished ? "no" : "yes");
  // Solo las categorías que tiene este WOD; si la tuya no está, la más cercana (RX ↔ Élite)
  const allowed = wodDivisions(wod);
  const pick = (d?: Division) => (d && allowed.includes(d) ? d : d === "rx" && allowed.includes("elite") ? "elite" : d === "elite" && allowed.includes("rx") ? "rx" : allowed[0]);
  const [div, setDiv] = useState<Division>(single ? (allowed.includes("rx") ? "rx" : (allowed.find((d) => d !== "scaled") ?? "rx")) : pick(existing?.division ?? defaultDivision ?? "rx"));
  const formRef = useRef<HTMLFormElement>(null);
  const [fromTimer, setFromTimer] = useState<string | null>(null);
  // Esfuerzo percibido (opcional) y foto para el feed (opcional, se reduce en el móvil antes de subir)
  const [effort, setEffort] = useState<number | null>(existing?.effort ?? null);
  const [photo, setPhoto] = useState<{ file: File; src: string } | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(!!existing?.photo_path);
  const [shrinking, setShrinking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.src);
  }, [photo]);
  const withExtras = (fd: FormData) => {
    fd.delete("photo_pick");
    if (photo) fd.set("photo", photo.file);
    if (!photo && !keepPhoto && existing?.photo_path) fd.set("remove_photo", "1");
    return fd;
  };
  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setShrinking(true);
    try {
      const small = await shrinkPhoto(f);
      setPhoto({ file: small, src: URL.createObjectURL(small) });
    } catch {
      alert(t("No se ha podido preparar la imagen. Inténtalo otra vez."));
    } finally {
      setShrinking(false);
    }
  }

  // Guardado: la foto nueva ya está subida (no se vuelve a subir si se guarda otra vez)
  useEffect(() => {
    if (!state?.ok || !last.current) return;
    const sent = last.current;
    if (sent.get("photo")) {
      setPhoto(null);
      setKeepPhoto(true);
    } else if (sent.get("remove_photo")) setKeepPhoto(false);
  }, [state]);


  // «Usar en mi resultado» del timer: rellena el tiempo (o las rondas); el atleta lo revisa y guarda
  useEffect(() => {
    const on = (ev: Event) => {
      const d = (ev as CustomEvent<TimerResult>).detail;
      if (!d || d.wodId !== wod.id) return;
      if (d.seconds != null) setFinished("yes");
      if (d.capped) setFinished("no");
      setTimeout(() => {
        const f = formRef.current;
        if (!f) return;
        const put = (name: string, v: string) => {
          const el = f.elements.namedItem(name) as HTMLInputElement | null;
          if (el) el.value = v;
        };
        if (d.seconds != null) {
          put("time_min", String(Math.floor(d.seconds / 60)));
          put("time_sec", String(d.seconds % 60));
        }
        if (d.rounds != null && wod.score_type === "amrap") put("rounds", String(d.rounds));
        f.scrollIntoView({ behavior: "smooth", block: "center" });
        (f.elements.namedItem(d.capped ? "reps" : d.seconds != null ? "time_min" : "reps") as HTMLInputElement | null)?.focus({ preventScroll: true });
      }, 50);
      setFromTimer(d.seconds != null ? `${Math.floor(d.seconds / 60)}:${String(d.seconds % 60).padStart(2, "0")}` : d.capped ? "CAP" : String(d.rounds ?? 0));
    };
    window.addEventListener(TIMER_EVENT, on);
    return () => window.removeEventListener(TIMER_EVENT, on);
  }, [wod.id, wod.score_type]);
  const unit = wod.score_label || SCORE_TYPES[wod.score_type].unit;

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        send(withExtras(new FormData(e.currentTarget)));
      }}
      className="card space-y-4 p-4"
    >
      <input type="hidden" name="wod_id" value={wod.id} />
      <h2 className="h-display text-2xl">{existing ? t("Tu resultado") : t("Mete tu resultado")}</h2>

      {single ? <input type="hidden" name="division" value={div} /> : <div>
        <span className="label">{t("Categoría")}</span>
        <Segmented<Division>
          small
          name="division"
          options={DIVISIONS.filter((d) => allowed.includes(d.value)).map((d) => ({ ...d, label: t(d.label) }))}
          defaultValue={div}
          onChange={setDiv}
        />
        {div === "scaled" && <p className="mt-1 text-xs text-muted">{t("En escalado no hay ranking: cuenta lo que has hecho y el día cuenta para tu racha.")}</p>}
      </div>}

      {div !== "scaled" && wod.score_type === "for_time" && (
        <>
          <div>
            <span className="label">{wod.time_cap_seconds ? t("¿Acabaste en el cap ({cap})?", { cap: formatTime(wod.time_cap_seconds) }) : t("¿Acabaste?")}</span>
            <Segmented
              small
              name="finished"
              options={[
                { value: "yes", label: t("Acabé") },
                { value: "no", label: "Time cap" },
              ]}
              defaultValue={finished}
              onChange={setFinished}
            />
          </div>
          {finished === "yes" ? (
            <div>
              <span className="label">{t("Tiempo")}</span>
              {/* Minutos y segundos por separado: el teclado numérico del móvil no tiene «:» */}
              <div className="flex items-center gap-2">
                <input
                  name="time_min"
                  aria-label={t("Minutos")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  onInput={(e) => (e.currentTarget.value = twoDigits(e.currentTarget.value))}
                  className="input text-center text-2xl font-bold"
                  placeholder="min"
                  defaultValue={existing?.time_seconds ? Math.floor(existing.time_seconds / 60) : ""}
                />
                <span className="h-display text-3xl text-muted">:</span>
                <input
                  name="time_sec"
                  aria-label={t("Segundos")}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  onInput={(e) => (e.currentTarget.value = twoDigits(e.currentTarget.value, 59))}
                  className="input text-center text-2xl font-bold"
                  placeholder={t("seg")}
                  defaultValue={existing?.time_seconds ? String(existing.time_seconds % 60).padStart(2, "0") : ""}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="reps">{t("Reps completadas")}</label>
              <input id="reps" name="reps" type="number" min={0} className="input text-2xl font-bold" defaultValue={existing?.reps ?? ""} />
            </div>
          )}
        </>
      )}

      {div !== "scaled" && wod.score_type === "amrap" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="rounds">{t("Rondas")}</label>
            <input id="rounds" name="rounds" type="number" min={0} className="input text-2xl font-bold" defaultValue={existing?.rounds ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="reps">+ Reps</label>
            <input id="reps" name="reps" type="number" min={0} className="input text-2xl font-bold" defaultValue={existing?.reps ?? 0} />
          </div>
        </div>
      )}

      {div !== "scaled" && wod.score_type === "pace" && (
        <div>
          <span className="label">{t("Ritmo medio")} ({wod.score_label || "min/km"})</span>
          <div className="flex items-center gap-2">
            <input
              name="pace_min"
              aria-label={t("Minutos")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              onInput={(e) => (e.currentTarget.value = twoDigits(e.currentTarget.value))}
              className="input text-center text-2xl font-bold"
              placeholder="min"
              defaultValue={existing?.time_seconds ? Math.floor(existing.time_seconds / 60) : ""}
            />
            <span className="h-display text-3xl text-muted">:</span>
            <input
              name="pace_sec"
              aria-label={t("Segundos")}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              onInput={(e) => (e.currentTarget.value = twoDigits(e.currentTarget.value, 59))}
              className="input text-center text-2xl font-bold"
              placeholder={t("seg")}
              defaultValue={existing?.time_seconds ? String(existing.time_seconds % 60).padStart(2, "0") : ""}
            />
          </div>
        </div>
      )}

      {div !== "scaled" && wod.score_type === "check" && (
        <p className="rounded-lg border border-line bg-bg p-3 text-sm text-muted">{t("Aquí no hay marca: guarda para dejarlo como hecho. Cuenta para tu racha.")}</p>
      )}

      {div !== "scaled" && !["for_time", "amrap", "pace", "check"].includes(wod.score_type) && (
        <div>
          <label className="label" htmlFor="value">
            {wod.score2_type && wod.score_name ? wod.score_name : t(SCORE_TYPES[wod.score_type].label).replace(/\s*\(.*\)/, "")}
            {unit ? ` (${unit})` : ""}
          </label>
          <input
            id="value"
            name="value"
            inputMode="decimal"
            className="input text-2xl font-bold"
            defaultValue={existing?.value ?? ""}
            placeholder="0"
          />
        </div>
      )}

      {div !== "scaled" && prNote && (
        <p className="text-xs text-muted">📈 {t("Se guarda también en Mis marcas: {m}", { m: prNote })}</p>
      )}

      {div !== "scaled" && wod.score2_type && (
        <div>
          <label className="label" htmlFor="value2">
            {wod.score2_name || t(SCORE_TYPES[wod.score2_type].label).replace(/\s*\(.*\)/, "")}
            {` (${wod.score2_label || SCORE_TYPES[wod.score2_type].unit})`}
          </label>
          <input
            id="value2"
            name="value2"
            inputMode="decimal"
            className="input text-2xl font-bold"
            defaultValue={existing?.value2 ?? ""}
            placeholder="0"
          />
        </div>
      )}

      <div>
        <label className="label" htmlFor="notes">{div === "scaled" ? t("¿Qué has hecho?") : single ? t("¿Has escalado algo? (opcional)") : t("Notas (opcional)")}</label>
        {div === "scaled" ? (
          <textarea
            id="notes"
            name="notes"
            rows={3}
            required
            className="input"
            placeholder={t("Back squat a 60 kg, 30 sandbag cleans con 1 min de descanso…")}
            defaultValue={existing?.notes ?? ""}
          />
        ) : (
          <input id="notes" name="notes" className="input" placeholder={single ? t("Qué has cambiado: peso, movimiento, reps… y cómo te has sentido") : t("Escalados, peso usado…")} defaultValue={existing?.notes ?? ""} />
        )}
      </div>

      {wod.score_type !== "check" && (
        <div>
          <span className="label">{t("Esfuerzo percibido (opcional)")}</span>
          <input type="hidden" name="effort" value={effort ?? ""} />
          <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label={t("Esfuerzo percibido (opcional)")}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={effort === n}
                onClick={() => setEffort(effort === n ? null : n)}
                className={`h-9 rounded-md border text-sm font-bold tabular-nums ${
                  effort === n ? "border-accent bg-accent text-accent-fg" : effort != null && n < effort ? "border-accent/40 bg-accent/15" : "border-line text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">{t("1 = muy suave · 10 = al límite. Lo ve tu coach para ajustar la carga.")}</p>
        </div>
      )}

      <div>
        <span className="label">{t("Foto (opcional)")}</span>
        <input ref={picker} name="photo_pick" type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt="" className="h-20 w-20 rounded-lg object-cover" />
            <div className="flex flex-col items-start gap-1 text-sm">
              <button type="button" onClick={() => picker.current?.click()} className="text-accent underline">{t("Cambiar foto")}</button>
              <button type="button" onClick={() => setPhoto(null)} className="text-muted underline">{t("Quitar")}</button>
            </div>
          </div>
        ) : keepPhoto ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">📷 {t("Tienes una foto en este resultado.")}</span>
            <button type="button" onClick={() => picker.current?.click()} className="text-accent underline">{t("Cambiar")}</button>
            <button type="button" onClick={() => setKeepPhoto(false)} className="text-muted underline">{t("Quitar")}</button>
          </div>
        ) : (
          <button type="button" onClick={() => picker.current?.click()} disabled={shrinking} className="btn-ghost inline-flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60">
            <Icon name="camera" size={16} /> {shrinking ? t("Preparando…") : t("Añadir una foto para el feed")}
          </button>
        )}
      </div>

      {fromTimer && !state && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          <Icon name="timer" size={15} /> {t("Del timer: {v}. Revísalo (puedes cambiarlo) y guarda.", { v: fromTimer })}
        </p>
      )}
      {state?.confirm && !pending ? (
        <div className="space-y-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Icon name="help" /> {t("¿Seguro que es así?")}</p>
          <p>{state.confirm}</p>
          <p className="text-muted">{t("Si te has equivocado, corrígelo arriba y vuelve a guardar.")}</p>
          <button
            type="button"
            className="btn-ghost w-full py-2.5"
            onClick={() => {
              const fd = new FormData();
              last.current?.forEach((v, k) => fd.append(k, v));
              fd.set("confirm", "1");
              send(fd);
            }}
          >
            {t("Sí, está bien: guardar")}
          </button>
        </div>
      ) : (
        <FormMessage state={state} />
      )}
      <button disabled={pending} className="btn w-full">{pending ? t("Guardando…") : existing ? t("Actualizar") : t("Guardar resultado")}</button>
    </form>
  );
}

/** Reduce la foto a 1440 px por el lado largo (JPEG): sube rápido y pesa poco */
async function shrinkPhoto(f: File): Promise<File> {
  const src = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("img"));
      i.src = src;
    });
    const k = Math.min(1, 1440 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise<Blob>((ok, ko) => c.toBlob((x) => (x ? ok(x) : ko(new Error("blob"))), "image/jpeg", 0.82));
    return new File([b], "foto.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(src);
  }
}
