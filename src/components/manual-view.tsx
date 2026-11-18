import { marked } from "marked";
import { BRAND } from "@/lib/brand";

/** Manual en pantalla: índice arriba y secciones con ancla. El contenido es nuestro (no viene de usuarios). */
export function ManualView({ md, title, intro }: { md: string; title: string; intro: string }) {
  const parts = md.split(/^## /m).filter((x) => x.trim());
  const sections = parts.map((p, i) => {
    const nl = p.indexOf("\n");
    const heading = p.slice(0, nl).trim();
    return { id: `s${i + 1}`, n: i + 1, heading, html: marked.parse(p.slice(nl + 1), { async: false }) as string };
  });
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">{BRAND.name}</div>
        <h1 className="h-title mt-1 text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">{intro}</p>
      </div>
      <nav className="card divide-y divide-line">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-6 font-semibold tabular-nums text-accent">{String(s.n).padStart(2, "0")}</span>
            {s.heading}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3">
          <h2 className="h-display flex items-baseline gap-3 text-2xl">
            <span className="text-base text-accent">{String(s.n).padStart(2, "0")}</span>
            {s.heading}
          </h2>
          <div className="manual" dangerouslySetInnerHTML={{ __html: s.html }} />
          <a href="#top" className="block text-right text-xs text-muted">↑ Índice</a>
        </section>
      ))}
    </div>
  );
}
