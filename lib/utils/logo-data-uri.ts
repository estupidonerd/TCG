import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// El logo vive en app/icon.png (Next lo usa tal cual como favicon de la
// pestaña). Los demás íconos (iPhone, app instalable) se arman con
// ImageResponse y necesitan el mismo archivo incrustado como data URI;
// se lee una sola vez en el build porque esas rutas son estáticas.
export function logoDataUri(): string {
  const png = readFileSync(join(process.cwd(), "app", "icon.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}
