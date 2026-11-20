"use client";

import { twoDigits } from "@/lib/scoring";
import { startTransition, useActionState, useRef, useState } from "react";
import { saveBenchmark, savePersonalRecord } from "@/app/actions";
import { BENCH_CATEGORIES, RM_CATEGORIES, RX_CATEGORIES, unitFor, type Benchmark, type PersonalRecord } from "@/lib/marcas";
import { SCORE_TYPES, type ScoreType } from "@/lib/types";
import { FormMessage, Segmented, SubmitButton } from "./ui";
import { DateInput } from "./date-input";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "@/components/icon";

/** Apuntar una marca: fecha, categoría (RX/escalado o RM según el tipo) y el score. */
export function PRForm({ benchmark, today, record }: { benchmark: Benchmark; today: string; record?: PersonalRecord }) {
  const [state, action, pending] = useActionState(savePersonalRecord, undefined);
  // Se envía a mano para que el formulario no se vacíe si hay que confirmar algo
  const last = useRef<FormData | null>(null);
  const send = (fd: FormData) => {
    last.current = fd;
    startTransition(() => action(fd));
  };
  const { t } = useI18n();
  const r = record;
  const [finished, setFinished] = useState<"yes" | "no">(r && !r.finished ? "no" : "yes");
  const ts = r?.time_seconds ?? null;
  const [hh, setHh] = useState(ts != null && ts >= 3600 ? String(Math.floor(ts / 3600)) : "");
  const [mm, setMm] = useState(ts != null ? String(Math.floor((ts % 3600) / 60) ) : "");
  const [ss, setSs] = useState(ts != null ? String(ts % 60) : "");
  const isRM = RM_CATEGORIES.includes(benchmark.category);
  const isRX = RX_CATEGORIES.includes(benchmark.category);
  const long = benchmark.category === "endurance" || ["Murph", "Clovis", "Chad", "Severin", "Lumberjack 20"].includes(benchmark.name);
  const unit = unitFor(benchmark);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(new FormData(e.currentTarget));
      }}
      className={r ? "space-y-4 pt-3" : "card space-y-4 p-4"}
    >
      <input type="hidden" name="benchmark_id" value={benchmark.id} />
      {r && <input type="hidden" name="id" value={r.id} />}
      {!r && <h2 className="h-display text-2xl">{t("Apuntar marca")}</h2>}
      <div>
        <label className="label" htmlFor={`performed_on${r ? r.id : ""}`}>{t("Fecha")}</label>
        <DateInput id={`performed_on${r ? r.id : ""}`} name="performed_on" defaultValue={r?.performed_on ?? today} required />
      </div>
      {isRX && (
        <div>
          <span className="label">{t("Categoría")}</span>
          <Segmented name="division" options={[{ value: "rx", label: "RX" }, { value: "scaled", label: t("Escalado") }]} defaultValue={r?.division ?? "rx"} />
        </div>
      )}
      {isRM && (
        <div>
          <span className="label">{t("Repeticiones máximas (RM)")}</span>
          <Segmented name="rm" options={["1", "2", "3", "5", "10"].map((v) => ({ value: v, label: `${v}RM` }))} defaultValue={String(r?.rm ?? 1)} />
        </div>
      )}

      {benchmark.score_type === "for_time" && (
        <>
          {!long && isRX && (
            <Segmented
              name="finished"
              options={[{ value: "yes", label: t("Acabé") }, { value: "no", label: "Time cap" }]}
              defaultValue={finished}
              onChange={setFinished}
            />
          )}
          {finished === "yes" ? (
            <div>
              <span className="label">{t("Tiempo")}</span>
              <div className="flex items-center gap-2">
                {long && (
                  <>
                    <input name="time_h" type="number" min={0} inputMode="numeric" value={hh} onChange={(e) => setHh(e.target.value)} className="input text-center text-2xl font-bold" placeholder="h" aria-label={t("Horas")} />
                    <span className="h-display text-3xl text-muted">:</span>
                  </>
                )}
                <input name="time_min" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={mm} onChange={(e) => setMm(twoDigits(e.target.value))} className="input text-center text-2xl font-bold" placeholder="min" aria-label={t("Minutos")} />
                <span className="h-display text-3xl text-muted">:</span>
                <input name="time_sec" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={ss} onChange={(e) => setSs(twoDigits(e.target.value, 59))} className="input text-center text-2xl font-bold" placeholder={t("seg")} aria-label={t("Segundos")} />
              </div>
              {(mm || ss || hh) && (
                <p className="mt-1 text-sm text-muted">
                  {t("Se guardará como")}{" "}
                  <b className="text-ink">
                    {hh ? `${Number(hh)}:${String(Number(mm) || 0).padStart(2, "0")}` : Number(mm) || 0}:{String(Number(ss) || 0).padStart(2, "0")}
                  </b>
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="reps">{t("Reps completadas")}</label>
              <input id="reps" name="reps" type="number" min={0} defaultValue={r?.reps ?? undefined} className="input text-2xl font-bold" />
            </div>
          )}
        </>
      )}
      {benchmark.score_type === "amrap" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="rounds">{t("Rondas")}</label>
            <input id="rounds" name="rounds" type="number" min={0} defaultValue={r?.rounds ?? undefined} className="input text-2xl font-bold" />
          </div>
          <div>
            <label className="label" htmlFor="reps">+ Reps</label>
            <input id="reps" name="reps" type="number" min={0} defaultValue={r?.reps ?? 0} className="input text-2xl font-bold" />
          </div>
        </div>
      )}
      {!["for_time", "amrap"].includes(benchmark.score_type) && (
        <div>
          <label className="label" htmlFor="value">
            {t(SCORE_TYPES[benchmark.score_type].label).replace(/\s*\(.*\)/, "")}
            {unit ? ` (${unit})` : ""}
          </label>
          <input id="value" name="value" inputMode="decimal" defaultValue={r?.value ?? undefined} className="input text-2xl font-bold" placeholder="0" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="notes">{t("Notas (opcional)")}</label>
        <input id="notes" name="notes" defaultValue={r?.notes ?? undefined} className="input" placeholder={t("Escalados, peso usado…")} />
      </div>
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
      <button disabled={pending} className="btn w-full">{pending ? t("Guardando…") : r ? t("Guardar cambios") : t("Guardar marca")}</button>
    </form>
  );
}

/** Coaches: añadir o editar un benchmark del catálogo. */
export function BenchmarkForm({ benchmark, defaultCategory }: { benchmark?: Benchmark; defaultCategory?: string }) {
  const [state, action] = useActionState(saveBenchmark, undefined);
  const { t } = useI18n();
  return (
    <form action={action} className="card space-y-3 p-4">
      {benchmark && <input type="hidden" name="id" value={benchmark.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="b_cat">{t("Categoría")}</label>
          <select id="b_cat" name="category" className="input" defaultValue={benchmark?.category ?? defaultCategory ?? "girls"}>
            {BENCH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {t(c.label)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="b_type">{t("Tipo de resultado")}</label>
          <select id="b_type" name="score_type" className="input" defaultValue={benchmark?.score_type ?? "for_time"}>
            {(Object.keys(SCORE_TYPES) as ScoreType[]).map((st) => (
              <option key={st} value={st}>{t(SCORE_TYPES[st].label)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="b_name">{t("Nombre")}</label>
        <input id="b_name" name="name" className="input" required maxLength={80} defaultValue={benchmark?.name} />
      </div>
      <div>
        <label className="label" htmlFor="b_desc">{t("Descripción (pesos, reps…)")}</label>
        <textarea id="b_desc" name="description" rows={3} className="input" defaultValue={benchmark?.description} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full">{benchmark ? t("Guardar cambios") : t("Añadir benchmark")}</SubmitButton>
    </form>
  );
}
