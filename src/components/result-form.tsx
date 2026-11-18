"use client";

import { useActionState, useState } from "react";
import { saveResult } from "@/app/actions";
import { formatTime } from "@/lib/scoring";
import { DIVISIONS, SCORE_TYPES, type Division, type Result, type Wod } from "@/lib/types";
import { FormMessage, Segmented, SubmitButton } from "./ui";
import { useI18n } from "@/lib/i18n/client";

export function ResultForm({ wod, existing, defaultDivision }: { wod: Wod; existing: Result | null; defaultDivision?: Division }) {
  const [state, action] = useActionState(saveResult, undefined);
  const { t } = useI18n();
  const [finished, setFinished] = useState<"yes" | "no">(existing && !existing.finished ? "no" : "yes");
  const [div, setDiv] = useState<Division>(existing?.division ?? defaultDivision ?? "rx");
  const unit = wod.score_label || SCORE_TYPES[wod.score_type].unit;

  return (
    <form action={action} className="card space-y-4 p-4">
      <input type="hidden" name="wod_id" value={wod.id} />
      <h2 className="h-display text-2xl">{existing ? t("Tu resultado") : t("Mete tu resultado")}</h2>

      <div>
        <span className="label">{t("Categoría")}</span>
        <Segmented<Division>
          name="division"
          options={DIVISIONS.map((d) => ({ ...d, label: t(d.label) }))}
          defaultValue={div}
          onChange={setDiv}
        />
        {div === "scaled" && <p className="mt-1 text-xs text-muted">{t("En escalado no hay ranking: cuenta lo que has hecho y el día cuenta para tu racha.")}</p>}
      </div>

      {div !== "scaled" && wod.score_type === "for_time" && (
        <>
          <div>
            <span className="label">{wod.time_cap_seconds ? t("¿Acabaste en el cap ({cap})?", { cap: formatTime(wod.time_cap_seconds) }) : t("¿Acabaste?")}</span>
            <Segmented
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
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="input text-center text-2xl font-bold"
                  placeholder="min"
                  defaultValue={existing?.time_seconds ? Math.floor(existing.time_seconds / 60) : ""}
                />
                <span className="h-display text-3xl text-muted">:</span>
                <input
                  name="time_sec"
                  aria-label={t("Segundos")}
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
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

      {div !== "scaled" && !["for_time", "amrap"].includes(wod.score_type) && (
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
        <label className="label" htmlFor="notes">{div === "scaled" ? t("¿Qué has hecho?") : t("Notas (opcional)")}</label>
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
          <input id="notes" name="notes" className="input" placeholder={t("Escalados, peso usado…")} defaultValue={existing?.notes ?? ""} />
        )}
      </div>

      <FormMessage state={state} />
      <SubmitButton className="w-full">{existing ? t("Actualizar") : t("Guardar resultado")}</SubmitButton>
    </form>
  );
}
