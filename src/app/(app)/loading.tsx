// Esqueleto que se ve al instante mientras carga cualquier pantalla
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Cargando">
      <div className="h-11 rounded-lg bg-card" />
      <div className="h-10 w-2/3 rounded-lg bg-card" />
      <div className="h-32 rounded-xl bg-card" />
      <div className="h-56 rounded-xl bg-card" />
    </div>
  );
}
