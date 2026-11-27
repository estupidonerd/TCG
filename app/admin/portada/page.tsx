import { redirect } from "next/navigation";

// /admin/portada es solo la puerta: cada pestaña vive en su propia carpeta.
export default function PortadaIndexPage() {
  redirect("/admin/portada/acceso");
}
