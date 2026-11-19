"use client";

import { DateInput } from "./date-input";
import { useActionState, useState } from "react";
import { createWod, updateWod } from "@/app/actions";
import { formatTime } from "@/lib/scoring";
import { DIVISIONS, SCORE2_TYPES, SCORE_TYPES, wodDivisions, type Score2Type, type ScoreType, type Wod } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { FormMessage, SubmitButton } from "./ui";

export function WodForm({ wod, defaultDate, defaultPart }: { wod?: Wod; defaultDate?: string; defaultPart?: string }) {
  const [state, action] = useActionState(wod ? updateWod : createWod, undefined);
  const { t } = useI18n();
  const [type, setType] = useState<ScoreType>(wod?.score_type ?? "for_time");
  const [type2, setType2] = useState<Score2Type | "">(wod?.score2_type ?? "");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

  return (
    <form action={action} className="card space-y-4 p-4">
      {wod && <input type="hidden" name="id" value={wod.id} />}

      <div className="grid grid-cols-[1fr_4.5rem] gap-3">
        <div>
          <label className="label" htmlFor="wod_date">{t("Fecha")}</label>
          <DateInput id="wod_date" name="wod_date" defaultValue={wod?.wod_date ?? defaultDate ?? today} required />
        </div>
        <div>
          <label className="label" htmlFor="part">{t("Parte")}</label>
          <input id="part" name="part" className="input text-center font-bold uppercase" maxLength={3} defaultValue={wod?.part ?? defaultPart ?? "A"} required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="title">{t("Título")}</label>
        <input id="title" name="title" className="input" placeholder={t("Fran, Back Squat 1RM, WOD…")} defaultValue={wod?.title} required />
      </div>

      <div>
        <label className="label" htmlFor="description">{t("WOD (pega aquí el texto de la plani)")}</label>
        <textarea
          id="description"
          name="description"
          rows={8}
          className="input font-mono text-sm"
          placeholder={"21-15-9\nThrusters 43/30 kg\nPull-ups"}
          defaultValue={wod?.description}
        />
      </div>

      <div>
        <span className="label">{t("Tipo de resultado")}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(SCORE_TYPES) as ScoreType[]).map((st) => (
            <label key={st} className="cursor-pointer">
              <input
                type="radio"
                name="score_type"
                value={st}
                checked={type === st}
                onChange={() => setType(st)}
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-line px-2 py-2 text-center text-sm font-semibold text-muted transition peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-fg">
                {t(SCORE_TYPES[st].label)}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t(SCORE_TYPES[type].help)}</p>
      </div>

      {type === "for_time" && (
        <div>
          <label className="label" htmlFor="time_cap">{t("Time cap (mm:ss, opcional)")}</label>
          <input
            id="time_cap"
            name="time_cap"
            className="input"
            placeholder="12:00"
            defaultValue={wod?.time_cap_seconds ? formatTime(wod.time_cap_seconds) : ""}
          />
        </div>
      )}

      {!["for_time", "amrap"].includes(type) && (
        <div>
          <label className="label" htmlFor="score_label">{t("Unidad / etiqueta (opcional)")}</label>
          <input
            id="score_label"
            name="score_label"
            className="input"
            placeholder={SCORE_TYPES[type].unit ?? ""}
            defaultValue={wod?.score_label ?? ""}
          />
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-line p-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!type2}
            onChange={(e) => setType2(e.target.checked ? "reps" : "")}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            {t("Añadir un segundo score")}
            <span className="block text-xs text-muted">{t("Para WODs con dos marcas (p. ej. kg del back squat y reps de sandbag clean). Cada score tiene su ranking.")}</span>
          </span>
        </label>
        <input type="hidden" name="score2_type" value={type2} />
        {type2 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SCORE2_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setType2(st)}
                className={`rounded-lg border px-2 py-2 text-center text-sm font-semibold transition ${type2 === st ? "border-accent bg-accent text-accent-fg" : "border-line text-muted"}`}
              >
                {t(SCORE_TYPES[st].label)}
              </button>
            ))}
          </div>
        )}
        {type2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="score_name">{t("Nombre del score 1")}</label>
                <input id="score_name" name="score_name" className="input" placeholder="Back squat" defaultValue={wod?.score_name ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="score2_name">{t("Nombre del score 2")}</label>
                <input id="score2_name" name="score2_name" className="input" placeholder="Sandbag clean" defaultValue={wod?.score2_name ?? ""} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="score2_label">{t("Unidad del score 2 (opcional)")}</label>
              <input id="score2_label" name="score2_label" className="input" placeholder={SCORE_TYPES[type2].unit ?? ""} defaultValue={wod?.score2_label ?? ""} />
            </div>
          </>
        )}
      </div>

      <div>
        <span className="label">{t("Categorías de este WOD")}</span>
        <div className="flex flex-wrap gap-4 text-sm">
          {DIVISIONS.map((d) => (
            <label key={d.value} className="flex items-center gap-2">
              <input type="checkbox" name="divisions" value={d.value} defaultChecked={wodDivisions(wod ?? {}).includes(d.value)} className="size-4 accent-[var(--accent)]" />
              {t(d.label)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t("Si Élite y RX son iguales, desmarca una: así todos compiten en el mismo ranking.")}</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="is_benchmark" defaultChecked={wod?.is_benchmark ?? false} className="mt-0.5 size-4 accent-[var(--accent)]" />
        <span>
          ★ {t("Benchmark: cuenta para los PRs del atleta.")}
          <span className="block text-xs text-muted">{t("Usa siempre el mismo título (p. ej. «Fran» o «Back Squat 1RM») para que se comparen entre fechas.")}</span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={wod?.published ?? true} className="size-4 accent-[var(--accent)]" />
        {t("Publicado (visible para los atletas)")}
      </label>

      <FormMessage state={state} />
      <SubmitButton className="w-full">{wod ? t("Guardar cambios") : t("Crear WOD")}</SubmitButton>
    </form>
  );
}
