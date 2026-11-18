"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

/** Buscador para abrir conversación con cualquier atleta. */
export function AthletePicker({ people }: { people: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const norm = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hits = q.trim() ? people.filter((p) => norm(p.name).includes(norm(q))).slice(0, 8) : [];
  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder={t("Busca un atleta por nombre…")} />
      {hits.length > 0 && (
        <ul className="card divide-y divide-line">
          {hits.map((p) => (
            <li key={p.id}>
              <button onClick={() => router.push(`/mensajes/${p.id}`)} className="w-full px-4 py-2.5 text-left">
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
