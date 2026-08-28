import Link from "next/link";

const SECTIONS = [
  {
    href: "/admin/sets",
    title: "Expansiones",
    description: "Crear y editar sets de cartas.",
  },
  {
    href: "/admin/cards",
    title: "Cartas",
    description: "Catálogo de cartas: imágenes, Género, Rasgo y Poder.",
  },
  {
    href: "/admin/packs",
    title: "Sobres",
    description: "Tipos de sobre: cantidad de cartas y pesos por rareza.",
  },
  {
    href: "/admin/codes",
    title: "Códigos",
    description: "Generar lotes de códigos canjeables.",
  },
  {
    href: "/admin/codes/stats",
    title: "Estadísticas de códigos",
    description: "Canjes por lote.",
  },
  {
    href: "/admin/ajustes",
    title: "Ajustes",
    description: "Dorso único de las cartas (pantalla e impresión).",
  },
];

export default function AdminHomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className="rounded-lg border border-marca-noche/10 bg-white p-4 transition-colors hover:border-marca-violeta"
        >
          <h2 className="text-lg">{section.title}</h2>
          <p className="mt-1 text-sm font-light text-marca-noche/70">
            {section.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
