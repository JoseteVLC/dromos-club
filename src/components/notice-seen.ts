"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * El layout no se vuelve a pintar al navegar dentro de la app, así que el contador de avisos
 * se quedaba con el número viejo hasta refrescar. Al pasar por /avisos lo damos por leído
 * aquí mismo (hasta que llegue un aviso más nuevo).
 */
export function useNoticesCleared(latest: string | null, prefix = "/avisos") {
  const path = usePathname();
  const [cleared, setCleared] = useState<string | null>(null);
  const onAvisos = path.startsWith(prefix);
  // Ajuste de estado durante el render (patrón recomendado por React en vez de un efecto)
  if (onAvisos && latest && cleared !== latest) setCleared(latest);
  return onAvisos || (latest != null && cleared === latest);
}
