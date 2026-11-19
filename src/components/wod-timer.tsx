"use client";

import { useEffect, useRef, useState } from "react";
import type { Wod } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";

/**
 * Timer del WOD: For Time (hacia arriba, con time cap opcional), AMRAP (hacia abajo) e intervalos
 * (EMOM, every X min, trabajo/descanso) por rondas. Cuenta atrás de 10 s, pitidos y pantalla siempre encendida.
 */
type Mode = "fortime" | "amrap" | "intervals";
type Cfg = { mode: Mode; cap: number; amrap: number; work: number; rest: number; rounds: number };

const PREP = 10; // segundos de cuenta atrás antes de empezar

const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const ss = String(v % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

/** Lo que se puede deducir del WOD para no tener que configurar nada. */
export function guess(wod: Pick<Wod, "title" | "description" | "score_type" | "time_cap_seconds">): Cfg {
  const text = `${wod.title}\n${wod.description}`;
  const cfg: Cfg = { mode: "fortime", cap: wod.time_cap_seconds ?? 0, amrap: 12 * 60, work: 60, rest: 0, rounds: 10 };
  const amrap = text.match(/amrap\s*(?:de\s*)?(\d{1,2})/i);
  const emom = text.match(/\bE(\d)?MOM\s*(?:x\s*)?(\d{1,2})?/i);
  const every = text.match(/every\s*(\d{1,2})(?:[:'](\d{2}))?\s*(?:min|m|')?[^\n]*?(?:x\s*(\d{1,2})|(\d{1,2})\s*(?:rounds|rondas|sets|series))/i);
  const tabata = /tabata/i.test(text);
  if (wod.score_type === "for_time") return cfg;
  if (wod.score_type === "amrap" || amrap) {
    cfg.mode = "amrap";
    if (amrap) cfg.amrap = parseInt(amrap[1], 10) * 60;
  } else if (tabata) {
    Object.assign(cfg, { mode: "intervals", work: 20, rest: 10, rounds: 8 });
  } else if (every) {
    const len = parseInt(every[1], 10) * 60 + (every[2] ? parseInt(every[2], 10) : 0);
    Object.assign(cfg, { mode: "intervals", work: len, rest: 0, rounds: parseInt(every[3] ?? every[4], 10) || 5 });
  } else if (emom || wod.score_type === "emom") {
    const each = emom?.[1] ? parseInt(emom[1], 10) : 1;
    const mins = emom?.[2] ? parseInt(emom[2], 10) : 10;
    Object.assign(cfg, { mode: "intervals", work: each * 60, rest: 0, rounds: Math.max(1, Math.round(mins / each)) });
  }
  return cfg;
}

// --- sonido
// Se usa <audio> con un pitido generado al vuelo (WAV): en iPhone, Web Audio se calla con el interruptor de silencio
// y el audio «multimedia» no. Cada sonido se desbloquea con el primer toque en «Empezar».
type Sound = "tick" | "go" | "end";
// [frecuencia, duración, fuerza de los armónicos]: los armónicos hacen que se oiga más fuerte sin saturar
const TONES: Record<Sound, [number, number, number]> = { tick: [880, 0.32, 0.25], go: [1175, 1.1, 0.6], end: [1175, 1.6, 0.6] };

function wav(freq: number, secs: number, harm: number): string {
  const rate = 22050;
  const n = Math.floor(rate * secs);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, x: string) => [...x].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let k = 0; k < n; k++) {
    const fade = Math.min(1, k / 150, (n - k) / 1500); // sin chasquidos al empezar y acabar
    const w = (2 * Math.PI * freq * k) / rate;
    const x = (Math.sin(w) + harm * Math.sin(2 * w) + harm * 0.6 * Math.sin(3 * w)) / (1 + harm * 1.6);
    v.setInt16(44 + k * 2, x * 0.98 * fade * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

const sounds: Partial<Record<Sound, HTMLAudioElement>> = {};
let unlocked = false;
function unlockSounds() {
  if (unlocked) return;
  unlocked = true;
  for (const k of Object.keys(TONES) as Sound[]) {
    const a = (sounds[k] ??= new Audio(wav(...TONES[k])));
    a.volume = 1;
    a.muted = true;
    void a.play().then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }).catch(() => (a.muted = false));
  }
}
function play(k: Sound) {
  const a = sounds[k];
  if (a) {
    a.currentTime = 0;
    void a.play().catch(() => {});
  }
  try {
    navigator.vibrate?.(k === "tick" ? 80 : k === "go" ? 300 : [300, 100, 300]);
  } catch {}
}

type View = { big: string; label: string; sub: string; tone: "prep" | "work" | "rest" | "done"; progress: number; finished: boolean };

function viewAt(cfg: Cfg, elapsed: number, t: (s: string, v?: Record<string, string | number>) => string): View {
  if (elapsed < PREP) return { big: String(Math.ceil(PREP - elapsed)), label: t("Prepárate"), sub: "", tone: "prep", progress: elapsed / PREP, finished: false };
  const s = elapsed - PREP;
  if (cfg.mode === "fortime") {
    if (cfg.cap && s >= cfg.cap) return { big: mmss(cfg.cap), label: t("Time cap"), sub: "", tone: "done", progress: 1, finished: true };
    return { big: mmss(Math.floor(s)), label: "For Time", sub: cfg.cap ? t("Time cap {cap}", { cap: mmss(cfg.cap) }) : "", tone: "work", progress: cfg.cap ? s / cfg.cap : 0, finished: false };
  }
  if (cfg.mode === "amrap") {
    if (s >= cfg.amrap) return { big: "0:00", label: t("¡Tiempo!"), sub: "", tone: "done", progress: 1, finished: true };
    return { big: mmss(cfg.amrap - s), label: "AMRAP", sub: t("de {min}", { min: mmss(cfg.amrap) }), tone: "work", progress: s / cfg.amrap, finished: false };
  }
  const len = cfg.work + cfg.rest;
  const total = len * cfg.rounds;
  if (s >= total) return { big: "0:00", label: t("¡Terminado!"), sub: t("{n} rondas", { n: cfg.rounds }), tone: "done", progress: 1, finished: true };
  const round = Math.floor(s / len) + 1;
  const within = s % len;
  const working = within < cfg.work;
  return {
    big: mmss(working ? cfg.work - within : len - within),
    label: working ? (cfg.rest ? t("Trabajo") : "GO") : t("Descanso"),
    sub: t("Ronda {r} de {n}", { r: round, n: cfg.rounds }),
    tone: working ? "work" : "rest",
    progress: s / total,
    finished: false,
  };
}

/** Segundo exacto en el que debe pitar (cambio de fase o últimos 3 s de la cuenta atrás de cada fase). */
function beepAt(cfg: Cfg, sec: number): "go" | "tick" | "end" | null {
  if (sec <= 0) return null;
  if (sec < PREP) return sec >= PREP - 5 ? "tick" : null;
  if (sec === PREP) return "go";
  const s = sec - PREP;
  if (cfg.mode === "fortime") return cfg.cap && s === cfg.cap ? "end" : cfg.cap && s >= cfg.cap - 5 && s < cfg.cap ? "tick" : null;
  if (cfg.mode === "amrap") return s === cfg.amrap ? "end" : s >= cfg.amrap - 5 && s < cfg.amrap ? "tick" : null;
  const len = cfg.work + cfg.rest;
  const total = len * cfg.rounds;
  if (s === total) return "end";
  if (s > total) return null;
  const within = s % len;
  if (within === 0 || (cfg.rest && within === cfg.work)) return "go";
  const toNext = within < cfg.work ? cfg.work - within : len - within;
  const phase = within < cfg.work ? cfg.work : cfg.rest;
  return toNext <= (phase >= 30 ? 5 : 3) ? "tick" : null;
}

/** Lo que el timer pasa al formulario de resultado («Usar en mi resultado»). */
export type TimerResult = { wodId: string; seconds?: number; capped?: boolean; rounds?: number };
export const TIMER_EVENT = "wod-timer-result";

/** Botones − valor + grandes, para no teclear con las manos sudadas. */
function Stepper({ label, value, onChange, step, min, max, fmt }: { label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number; fmt: (v: number) => string }) {
  const btn = "btn-ghost h-14 w-14 shrink-0 text-2xl";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - step))} aria-label="−">−</button>
        <span className="h-display w-24 text-center text-3xl tabular-nums">{fmt(value)}</span>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + step))} aria-label="+">+</button>
      </div>
    </div>
  );
}

export function WodTimer({
  wod,
  open: openProp,
  onOpenChange,
}: {
  wod: Pick<Wod, "id" | "title" | "description" | "score_type" | "time_cap_seconds">;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;
  const setOpen = onOpenChange ?? setOpenSelf;
  const [cfg, setCfg] = useState<Cfg>(() => guess(wod));
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null); // For Time: cuando pulsa «Terminar»
  const [taps, setTaps] = useState(0);
  const base = useRef(0); // ms acumulados antes de la última pausa
  const since = useRef(0); // instante en que se reanudó
  const lastBeep = useRef(-1);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  // Reloj: se calcula siempre desde la hora real, así no se desfasa aunque el móvil vaya lento
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const e = (base.current + performance.now() - since.current) / 1000;
      setElapsed(e);
      const sec = Math.floor(e);
      if (sec !== lastBeep.current) {
        lastBeep.current = sec;
        const b = beepAt(cfg, sec);
        if (b) play(b);
      }
      // Al acabar, se para solo
      if (viewAt(cfg, e, (x) => x).finished) {
        base.current += performance.now() - since.current;
        setRunning(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, cfg]);

  // Pantalla encendida mientras corre
  useEffect(() => {
    if (!running) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (k: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock.current = l)).catch(() => {});
    return () => {
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [running]);

  const view = viewAt(cfg, elapsed, t);
  const done = view.finished || stoppedAt != null;

  const start = () => {
    unlockSounds(); // el primer toque desbloquea el sonido (iPhone)
    since.current = performance.now();
    setStarted(true);
    setRunning(true);
  };
  const pause = () => {
    base.current += performance.now() - since.current;
    setRunning(false);
  };
  const finish = () => {
    pause();
    const e = (base.current) / 1000;
    setElapsed(e);
    setStoppedAt(Math.max(0, Math.round(e - PREP)));
    play("end");
  };
  const reset = () => {
    base.current = 0;
    lastBeep.current = -1;
    setElapsed(0);
    setTaps(0);
    setStoppedAt(null);
    setRunning(false);
    setStarted(false);
  };
  const close = () => {
    reset();
    setOpen(false);
  };
  /** Pasa el tiempo (o las rondas) al formulario de resultado, que el atleta revisa y guarda. */
  const useIt = () => {
    const detail: TimerResult = { wodId: wod.id };
    if (cfg.mode === "fortime") {
      if (stoppedAt != null) detail.seconds = stoppedAt;
      else detail.capped = true;
      if (taps) detail.rounds = taps;
    } else detail.rounds = taps;
    window.dispatchEvent(new CustomEvent<TimerResult>(TIMER_EVENT, { detail }));
    close();
  };

  if (!open && onOpenChange) return null;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full py-3 text-sm">
        ⏱️ {t("Timer")}
      </button>
    );

  const tone = { prep: "text-muted", work: "text-accent", rest: "text-sky-400", done: "text-fg" }[view.tone];
  const set = (k: keyof Cfg, v: number | Mode) => setCfg((c) => ({ ...c, [k]: v }));
  const canUse = cfg.mode !== "intervals" && wod.score_type !== "load";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" data-noswipe>
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="truncate text-sm text-muted">{wod.title}</p>
        <button type="button" onClick={close} className="btn-ghost shrink-0 px-4 py-2 text-sm">✕ {t("Cerrar")}</button>
      </div>

      {!started ? (
        <div className="mx-auto w-full max-w-md flex-1 space-y-6 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["fortime", "For Time"],
                ["amrap", "AMRAP"],
                ["intervals", t("EMOM / Intervalos")],
              ] as const
            ).map(([m, label]) => (
              <button key={m} type="button" onClick={() => set("mode", m)} className={`chip justify-center py-3 ${cfg.mode === m ? "chip-on" : ""}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="card space-y-4 p-4">
            {cfg.mode === "fortime" && (
              <>
                <Stepper label={t("Time cap")} value={cfg.cap} step={60} min={0} max={180 * 60} onChange={(v) => set("cap", v)} fmt={(v) => (v ? mmss(v) : t("Sin cap"))} />
                <p className="text-xs text-muted">{t("Cuando acabes, pulsa «Terminar» y tu tiempo pasa al resultado.")}</p>
              </>
            )}
            {cfg.mode === "amrap" && (
              <>
                <Stepper label={t("Duración")} value={cfg.amrap} step={60} min={60} max={120 * 60} onChange={(v) => set("amrap", v)} fmt={mmss} />
                <div className="flex flex-wrap gap-2">
                  {[5, 7, 10, 12, 15, 20].map((m) => (
                    <button key={m} type="button" onClick={() => set("amrap", m * 60)} className={`chip ${cfg.amrap === m * 60 ? "chip-on" : ""}`}>{m}&apos;</button>
                  ))}
                </div>
              </>
            )}
            {cfg.mode === "intervals" && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["EMOM", 60, 0, cfg.rounds],
                      ["E2MOM", 120, 0, cfg.rounds],
                      ["E3MOM", 180, 0, cfg.rounds],
                      ["1' on / 1' off", 60, 60, cfg.rounds],
                      ["Tabata", 20, 10, 8],
                    ] as const
                  ).map(([name, w, r, n]) => (
                    <button key={name} type="button" onClick={() => setCfg((c) => ({ ...c, work: w, rest: r, rounds: n }))} className={`chip ${cfg.work === w && cfg.rest === r ? "chip-on" : ""}`}>{name}</button>
                  ))}
                </div>
                <Stepper label={t("Trabajo")} value={cfg.work} step={cfg.work >= 60 ? 15 : 5} min={5} max={30 * 60} onChange={(v) => set("work", v)} fmt={mmss} />
                <Stepper label={t("Descanso")} value={cfg.rest} step={cfg.rest >= 60 ? 15 : 5} min={0} max={30 * 60} onChange={(v) => set("rest", v)} fmt={(v) => (v ? mmss(v) : "—")} />
                <Stepper label={t("Rondas")} value={cfg.rounds} step={1} min={1} max={99} onChange={(v) => set("rounds", v)} fmt={(v) => String(v)} />
                <p className="text-xs text-muted">{t("Total: {t}", { t: mmss((cfg.work + cfg.rest) * cfg.rounds) })}</p>
              </>
            )}
          </div>
          <button type="button" onClick={start} className="btn w-full py-5 text-xl">▶ {t("Empezar")}</button>
        </div>
      ) : done ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
          <p className="h-display text-2xl uppercase text-accent">{cfg.mode === "fortime" ? (stoppedAt == null ? t("Time cap") : t("¡Terminado!")) : view.label}</p>
          {cfg.mode === "fortime" && stoppedAt != null && <p className="h-display tabular-nums leading-none" style={{ fontSize: "min(26vw, 30vh)" }}>{mmss(stoppedAt)}</p>}
          {cfg.mode !== "intervals" && (
            <div className="w-full">
              <Stepper label={t("Rondas completas")} value={taps} step={1} min={0} max={999} onChange={setTaps} fmt={(v) => String(v)} />
            </div>
          )}
          {canUse && (
            <button type="button" onClick={useIt} className="btn w-full py-4 text-lg">
              ✓ {t("Usar en mi resultado")}
            </button>
          )}
          <button type="button" onClick={reset} className="btn-ghost w-full py-3">↺ {t("Volver a empezar")}</button>
        </div>
      ) : (
        <div
          className="flex flex-1 select-none flex-col items-center justify-center gap-4 p-4 text-center"
          onClick={() => (cfg.mode !== "intervals" && running && elapsed >= PREP ? setTaps((n) => n + 1) : undefined)}
        >
          <p className={`h-display text-2xl uppercase ${tone}`}>{view.label}</p>
          <p className={`h-display tabular-nums leading-none ${tone}`} style={{ fontSize: cfg.mode !== "intervals" && elapsed >= PREP ? "min(26vw, 28vh)" : "min(32vw, 40vh)" }}>{view.big}</p>
          {view.sub && <p className="text-lg text-muted">{view.sub}</p>}
          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(100, view.progress * 100)}%` }} />
          </div>
          {cfg.mode !== "intervals" && elapsed >= PREP && (
            <div className="mt-2 flex items-center gap-5">
              <div className="flex flex-col items-center">
                <span className="text-sm font-semibold uppercase tracking-widest text-muted">{t("Rondas")}</span>
                <span className="h-display tabular-nums leading-none text-fg" style={{ fontSize: "min(22vw, 24vh)" }}>{taps}</span>
              </div>
              {taps > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaps((n) => Math.max(0, n - 1));
                  }}
                  className="btn-ghost h-14 w-14 text-2xl"
                  aria-label={t("Quitar una ronda")}
                >
                  −1
                </button>
              )}
            </div>
          )}
          {cfg.mode !== "intervals" && elapsed >= PREP && <p className="text-sm text-muted">{t("Toca la pantalla para sumar una ronda")}</p>}
        </div>
      )}

      {started && !done && (
        <div className="grid grid-cols-2 gap-3 p-6">
          {running ? (
            <button type="button" onClick={pause} className="btn-ghost py-5 text-lg">⏸ {t("Pausa")}</button>
          ) : (
            <button type="button" onClick={start} className="btn-ghost py-5 text-lg">▶ {t("Seguir")}</button>
          )}
          {cfg.mode === "fortime" && elapsed >= PREP ? (
            <button type="button" onClick={finish} className="btn py-5 text-lg">🏁 {t("Terminar")}</button>
          ) : (
            <button type="button" onClick={reset} className="btn-ghost py-5 text-lg">↺ {t("Reiniciar")}</button>
          )}
        </div>
      )}
    </div>
  );
}
