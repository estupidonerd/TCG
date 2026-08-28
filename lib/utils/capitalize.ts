// Los textos de habilidad en genres/traits se cargaron en minúscula al
// principio de la oración (así los dictaron originalmente). En vez de otra
// migración para editar el dato, se capitaliza al mostrar.
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
