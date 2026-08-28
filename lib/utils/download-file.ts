// Solo para uso en Client Components: dispara una descarga de un archivo
// generado en el momento (ej. un CSV armado con datos que ya llegaron del
// servidor), sin pasar por un link real.
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/csv;charset=utf-8;",
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function toSafeFilename(input: string): string {
  return input.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}
