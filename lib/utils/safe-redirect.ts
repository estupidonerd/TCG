// Evita open-redirects: solo deja pasar rutas internas ("/algo"), nunca URLs
// absolutas ni protocol-relative ("//evil.com") que un query param ?next=
// podría traer manipulado.
export function safeRedirectPath(
  path: string | null | undefined,
  fallback = "/",
) {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://")
  ) {
    return fallback;
  }
  return path;
}
