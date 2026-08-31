// Trae el archivo real de una fuente de Google Fonts para usar dentro de
// ImageResponse (next/og): Satori no tiene acceso a Google Fonts como el
// navegador, necesita los bytes de la fuente. Google sirve woff2 por
// defecto, que Satori no soporta -- pidiéndolo con un User-Agent viejo
// devuelve truetype/opentype, que sí. Si falla (sin red en build, Google
// caído, etc.) devuelve null y quien llama sigue sin fuente custom en vez
// de romper la imagen entera.
export async function loadGoogleFont(
  family: string,
  weight: number,
  text?: string,
): Promise<ArrayBuffer | null> {
  try {
    const params = new URLSearchParams({ family: `${family}:wght@${weight}` });
    if (text) params.set("text", text);

    // User-Agent de un navegador viejo a propósito: a uno "moderno" Google
    // le sirve woff2 (Satori no lo soporta). Probado a mano cuál formato
    // devuelve cada UA vieja: IE8 da .eot (tampoco sirve), pero un
    // Android 2.3 (browser nativo pre-Chrome) da truetype plano, que sí.
    const cssRes = await fetch(`https://fonts.googleapis.com/css2?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; U; Android 2.3.5; en-us; Nexus S Build/GRI54) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
      },
    });
    if (!cssRes.ok) return null;

    const css = await cssRes.text();
    const match = css.match(/src: url\(([^)]+)\) format\('truetype'\)/);
    if (!match) return null;

    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;

    const buffer = await fontRes.arrayBuffer();
    // Sanity check antes de pasarlo a Satori: si esto no es un archivo de
    // fuente de verdad (por ejemplo una página de error servida como 200),
    // que ImageResponse reciba fonts:[] en vez de romper toda la imagen.
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}
