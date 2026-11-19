/**
 * Cómo tiene que sonar el texto en cada idioma: como un coach nativo de un box de ese país, no como una traducción.
 * Se añade a los prompts del consejo, el calentamiento y el resumen semanal.
 */
const VOICE: Record<string, string> = {
  es: `Escribe en español de España, como habla de verdad un coach en un box español. No traduzcas del inglés ni calques sus estructuras.
- Términos de remo, bici y ski: «paladas por minuto» (nunca «strokes» ni «golpes»), «ritmo» (no «pace»), «calorías» o «cal», «a 2:00 los 500 m».
- Usa lo que se dice en los boxes: «series», «repeticiones» o «reps», «sin soltar» o «del tirón» (en vez de «unbroken» si queda raro), «partir las series», «aguantar el ritmo», «barra», «discos», «kettlebell», «mancuerna».
- Los nombres de los movimientos se dejan como se dicen en el box aunque sean en inglés (thruster, wall ball, burpee, toes to bar, pull-up, clean, snatch, double unders), sin inventar traducciones raras.
- Frases cortas y naturales, como se las dirías en persona. Nada de «asegúrate de», «es importante que», «recuerda que» ni fórmulas de manual.
- Decimales con coma (2,5 kg).`,
  en: `Write in natural English, the way a coach actually talks in a box: short, direct sentences. Use standard CrossFit terms (strokes per minute, pace, cal, unbroken, sets). Avoid filler like "make sure to" or "it's important to".`,
  fr: `Écris en français naturel, comme parle vraiment un coach dans une box en France, pas comme une traduction de l'anglais.
- Aviron, vélo, ski : «coups de rame par minute» ou «cadence», «allure», «calories» ou «cal».
- Dis «séries», «répétitions» ou «reps», «sans lâcher», «barre», «disques», «kettlebell», «haltère». Garde les noms des mouvements comme on les dit en box (thruster, wall ball, burpee, toes to bar, clean, snatch).
- Phrases courtes et naturelles, tutoiement. Pas de formules comme «assure-toi de» ou «il est important de». Décimales avec une virgule (2,5 kg).`,
  pl: `Pisz naturalnym polskim, tak jak naprawdę mówi trener w boksie w Polsce, a nie jak tłumaczenie z angielskiego.
- Wiosła, rower, ski: «ruchy na minutę» lub «tempo», «kalorie» lub «cal».
- Mów «serie», «powtórzenia», «bez przerwy», «sztanga», «talerze», «kettlebell», «hantla». Nazwy ćwiczeń zostaw tak, jak mówi się w boksie (thruster, wall ball, burpee, toes to bar, clean, snatch).
- Krótkie, naturalne zdania, na «ty». Bez sztucznych formułek. Ułamki z przecinkiem (2,5 kg).`,
};

const LANG: Record<string, string> = { es: "español", en: "English", fr: "français", pl: "polski" };

export const langName = (locale: string) => LANG[locale] ?? "español";
export const voice = (locale: string) => VOICE[locale] ?? VOICE.es;
