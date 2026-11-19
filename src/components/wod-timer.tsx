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
const toSec = (txt: string) => {
  const p = txt.trim().split(":").map((x) => parseInt(x, 10) || 0);
  return p.length === 1 ? p[0] * 60 : p[0] * 60 + (p[1] ?? 0);
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
const TONES: Record<Sound, [number, number]> = { tick: [880, 0.15], go: [1320, 0.45], end: [660, 1.2] };

function wav(freq: number, secs: number): string {
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
    const fade = Math.min(1, k / 200, (n - k) / 800); // sin chasquidos al empezar y acabar
    v.setInt16(44 + k * 2, Math.sin((2 * Math.PI * freq * k) / rate) * 0.9 * fade * 32767, true);
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
  if (cfg.mode === "fortime") return cfg.cap && s === cfg.cap ? "end" : cfg.cap && s >= cfg.cap - 3 && s < cfg.cap ? "tick" : null;
  if (cfg.mode === "amrap") return s === cfg.amrap ? "end" : s >= cfg.amrap - 3 && s < cfg.amrap ? "tick" : null;
  const len = cfg.work + cfg.rest;
  const total = len * cfg.rounds;
  if (s === total) return "end";
  if (s > total) return null;
  const within = s % len;
  if (within === 0 || (cfg.rest && within === cfg.work)) return "go";
  const toNext = within < cfg.work ? cfg.work - within : len - within;
  return toNext <= 3 ? "tick" : null;
}

export function WodTimer({ wod }: { wod: Pick<Wod, "title" | "description" | "score_type" | "time_cap_seconds"> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<Cfg>(() => guess(wod));
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
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

  const view = viewAt(cfg, elapsed, t);

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
  const reset = () => {
    base.current = 0;
    lastBeep.current = -1;
    setElapsed(0);
    setTaps(0);
    setRunning(false);
    setStarted(false);
  };
  const close = () => {
    reset();
    setOpen(false);
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full py-3 text-sm">
        ⏱️ {t("Timer")}
      </button>
    );

  const tone = { prep: "text-muted", work: "text-accent", rest: "text-sky-400", done: "text-fg" }[view.tone];
  const field = "input w-24 text-center";
  const set = (k: keyof Cfg, v: number | Mode) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" data-noswipe>
      <div className="flex items-center justify-between p-4">
        <p className="truncate text-sm text-muted">{wod.title}</p>
        <button type="button" onClick={close} className="btn-ghost px-3 py-1.5 text-sm">✕ {t("Cerrar")}</button>
      </div>

      {!started ? (
        <div className="mx-auto w-full max-w-sm flex-1 space-y-6 overflow-y-auto p-4">
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

          {cfg.mode === "fortime" && (
            <label className="flex items-center justify-between gap-3">
              <span>{t("Time cap (mm:ss, vacío = sin cap)")}</span>
              <input className={field} inputMode="numeric" defaultValue={cfg.cap ? mmss(cfg.cap) : ""} placeholder="—" onChange={(e) => set("cap", e.target.value.trim() ? toSec(e.target.value) : 0)} />
            </label>
          )}
          {cfg.mode === "amrap" && (
            <label className="flex items-center justify-between gap-3">
              <span>{t("Duración (mm:ss)")}</span>
              <input className={field} inputMode="numeric" defaultValue={mmss(cfg.amrap)} onChange={(e) => set("amrap", Math.max(1, toSec(e.target.value)))} />
            </label>
          )}
          {cfg.mode === "intervals" && (
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span>{t("Trabajo (mm:ss)")}</span>
                <input className={field} inputMode="numeric" defaultValue={mmss(cfg.work)} onChange={(e) => set("work", Math.max(1, toSec(e.target.value)))} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>{t("Descanso (mm:ss, 0 = EMOM)")}</span>
                <input className={field} inputMode="numeric" defaultValue={mmss(cfg.rest)} onChange={(e) => set("rest", Math.max(0, toSec(e.target.value)))} />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>{t("Rondas")}</span>
                <input className={field} type="number" min={1} max={99} defaultValue={cfg.rounds} onChange={(e) => set("rounds", Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </label>
              <p className="text-xs text-muted">
                {t("Ejemplos: EMOM 10 → 1:00 / 0:00 / 10 · Every 2 min x 5 → 2:00 / 0:00 / 5 · 1 min on 1 min off x 8 → 1:00 / 1:00 / 8 · Tabata → 0:20 / 0:10 / 8")}
              </p>
            </div>
          )}
          <button type="button" onClick={start} className="btn w-full py-4 text-lg">▶ {t("Empezar")}</button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center" onClick={() => (cfg.mode !== "intervals" && running ? setTaps((n) => n + 1) : undefined)}>
          <p className={`h-display text-2xl uppercase ${tone}`}>{view.label}</p>
          <p className={`h-display tabular-nums leading-none ${tone}`} style={{ fontSize: "min(32vw, 40vh)" }}>{view.big}</p>
          {view.sub && <p className="text-lg text-muted">{view.sub}</p>}
          <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.min(100, view.progress * 100)}%` }} />
          </div>
          {cfg.mode !== "intervals" && elapsed >= PREP && (
            <p className="text-sm text-muted">{t("Rondas: {n} · toca la pantalla para sumar una", { n: taps })}</p>
          )}
        </div>
      )}

      {started && (
        <div className="flex justify-center gap-3 p-6" onClick={(e) => e.stopPropagation()}>
          {!view.finished && (running ? (
            <button type="button" onClick={pause} className="btn px-8 py-4">⏸ {t("Pausa")}</button>
          ) : (
            <button type="button" onClick={start} className="btn px-8 py-4">▶ {t("Seguir")}</button>
          ))}
          <button type="button" onClick={reset} className="btn-ghost px-6 py-4">↺ {t("Reiniciar")}</button>
        </div>
      )}
    </div>
  );
}
