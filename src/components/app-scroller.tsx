"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Zona con scroll de la app (todo menos el menú de abajo). Al cambiar de página vuelve arriba,
 * como hacía la ventana antes de tener la pantalla fija.
 */
export function AppScroller({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [path]);
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      {children}
    </div>
  );
}
