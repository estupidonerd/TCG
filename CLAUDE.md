# Contexto del proyecto

Juego de cartas coleccionable en navegador. Los jugadores reciben códigos por
mail, los canjean por sobres aleatorios, arman su colección, intercambian
cartas con otros jugadores e imprimen sus cartas en casa.

## Stack
Next.js 15 App Router, TypeScript, Tailwind, Framer Motion, Supabase
(Auth con Google, Postgres, Storage, RLS), desplegado en Vercel.

## Dominio de producción
El juego se publica en tcg.estupidonerd.com (subdominio, vía CNAME en GoDaddy
apuntando a Vercel). El sitio principal del podcast en estupidonerd.com no se
toca.

## Reglas de diseño del juego (no negociables)
- Poder, Coste y Resistencia son el MISMO número por carta, escala 0-10. Nunca
  tres campos separados.
- Género (10 valores fijos) y Rasgo (5 valores fijos) son catálogos cerrados
  en las tablas genres y traits, cargados una sola vez. Nunca texto libre por
  carta. Cada carta referencia un genre_id y un trait_id, no más.
- La habilidad de cada carta no se escribe a mano: se deriva de su Género
  (base + versión Fandom con 3+ en mesa) y su Rasgo, leídas de genres/traits.
- El dorso de la carta es único para todo el juego (game_settings), nunca se
  sube por carta.

## Reglas innegociables
- Las cartas son datos en la base, nunca código. Agregar cartas o expansiones
  jamás debe requerir modificar el proyecto ni volver a desplegar.
- Toda lógica que otorgue o mueva cartas (canje, intercambio) vive en funciones
  de Postgres con SECURITY DEFINER y transacciones. Nunca en el cliente.
- La tabla codes no es legible por usuarios bajo ninguna condición.
- La service_role key nunca llega al navegador.
- Mobile-first siempre. Se prueba en celular antes de darlo por hecho.
- Todas las animaciones respetan prefers-reduced-motion.
- Textos de interfaz en español, tuteando (tú, tienes, puedes, haz clic), como
  se habla en Colombia. NUNCA voseo (nunca "vos", "tenés", "andá", "hacé clic").
  Si encontrás texto en voseo en el proyecto, es un error a corregir.

## Reglas de base de datos
- Desde el 30 de octubre de 2026, Supabase ya no da acceso automático a las
  tablas nuevas del esquema public. Toda migración que cree una tabla debe
  incluir, en el mismo archivo, sus GRANT con el mínimo permiso necesario:
  SELECT a anon solo si la tabla es de lectura pública; SELECT a authenticated
  en lo que el jugador debe leer (el RLS limita las filas); INSERT, UPDATE o
  DELETE a authenticated solo si el cliente escribe directo con una política
  de RLS; y todos los permisos a service_role. Si toda la escritura pasa por
  funciones SECURITY DEFINER, no des escritura directa a authenticated. El
  RLS sigue siendo obligatorio además del GRANT.

## Identidad de marca
Tipografía: Titillium Web (Google Fonts). Títulos y nombres de carta en peso 900
siempre en MAYÚSCULAS. Subtítulos en 300. Texto corrido en 400.

Paleta:
- #8100CC violeta, acento secundario y rareza rara
- #FF3333 rojo, títulos y acción principal
- #F2D80A amarillo, destacados y rareza legendaria
- #000021 azul casi negro, fondos inmersivos
- #EAEFF4 blanco azulado, fondo general

Interfaz general sobre #EAEFF4. Apertura de sobre y detalle de carta a pantalla
completa sobre #000021. Nunca uses colores fuera de esta paleta.

## Medidas de impresión
Carta final 63 x 88 mm. Bloque imprimible 63 x 176 mm: frente abajo en
orientación normal, dorso arriba rotado 180 grados, unidos por el borde
superior del frente. Se dobla por esa línea.

## Estado del proyecto
Al terminar cualquier tarea, actualiza ESTADO.md con lo que cambió.
