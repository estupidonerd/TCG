const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "") // saca acentos (normalize los separa de la letra)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
