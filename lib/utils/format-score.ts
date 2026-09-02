// Puntaje entero (ej. 1) se muestra sin decimal ("1"), no forzado a un
// decimal fijo ("1.0") como el resto de los valores no enteros.
export function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}
