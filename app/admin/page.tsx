import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { getAdminStats } from "./actions";

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
    href: "/admin/usuarios",
    title: "Usuarios",
    description: "Buscar jugadores y banearlos temporalmente.",
  },
  {
    href: "/admin/feedback",
    title: "Feedback",
    description: "Fallas y sugerencias que enviaron los jugadores.",
  },
  {
    href: "/admin/ajustes",
    title: "Ajustes",
    description: "Dorso único de las cartas (pantalla e impresión).",
  },
];

export default async function AdminHomePage() {
  // Repite el guard del layout: esta página llama directo a una acción
  // que usa el cliente service_role (getAdminStats), y Next puede empezar
  // a renderizarla en paralelo con el layout.
  await requireAdminOrRedirect();
  const stats = await getAdminStats();

  const STAT_ITEMS = [
    { label: "Usuarios registrados", value: stats.totalUsers.toLocaleString("es-CO") },
    {
      label: "Códigos canjeados / generados",
      value: `${stats.redeemedCodes.toLocaleString("es-CO")} / ${stats.totalCodes.toLocaleString("es-CO")}`,
    },
    { label: "Cartas en circulación", value: stats.cardsInCirculation.toLocaleString("es-CO") },
    { label: "Mazos guardados", value: stats.savedDecks.toLocaleString("es-CO") },
    { label: "Intercambios completados", value: stats.completedTrades.toLocaleString("es-CO") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {STAT_ITEMS.map((item) => (
          <div key={item.label} className="rounded-lg border border-marca-noche/10 bg-white p-4">
            <p className="text-2xl font-bold text-marca-noche">{item.value}</p>
            <p className="mt-1 text-xs text-marca-noche/60">{item.label}</p>
          </div>
        ))}
      </div>

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
    </div>
  );
}
