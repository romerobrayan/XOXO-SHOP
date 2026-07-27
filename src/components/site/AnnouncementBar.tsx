// Barra de anuncio: la promesa de discreción abre cada página.
// El checkout la cambia por la versión de empaque (ver handoff §4).
export function AnnouncementBar({
  children = "Envíos discretos en toda Colombia · Contra entrega en Medellín",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-vino px-4 py-2.5 text-center text-sm tracking-[0.5px] text-marfil">
      {children}
    </div>
  );
}
