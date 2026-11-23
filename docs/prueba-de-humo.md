# Prueba de humo después de cada paso a producción

Guion de unos 10 minutos. Se sigue **después de cada despliegue a producción**
(tcg.estupidonerd.com), y también en la vista previa de Pruebas cuando quieras
ensayarlo antes. No busca encontrar todos los errores: busca confirmar que lo
esencial sigue vivo. Si un paso falla, no sigas: anota el paso, la hora, lo que
viste en pantalla y avísale a Claude con eso.

## Antes de empezar (2 minutos)

- Una **cuenta normal** de Google que no sea admin (una cuenta de prueba tuya,
  no la de un jugador real) y la cuenta **admin**. Conviene usar dos
  navegadores o una ventana privada para no mezclar sesiones.
- Un **código de canje de prueba** sin usar. Si no tienes uno, créalo con la
  cuenta admin en `/admin/codes` (un lote de 1 código, de un sobre cualquiera)
  y cópialo. Úsalo solo con la cuenta de prueba: la carta que salga queda en
  esa colección.
- Abre las herramientas del navegador solo si algo falla; si no, no hace falta.
- Haz la prueba **en el celular**, o en el navegador con la vista de celular
  (el juego es mobile-first).

## Pasos

| # | Qué haces | Resultado esperado |
|---|---|---|
| 1 | Abre `https://tcg.estupidonerd.com` con la sesión cerrada. | La página carga sin errores, con la tipografía y los colores de la marca (fondo blanco azulado). El favicon es el logo, no un cuadro morado. |
| 2 | Inicia sesión con Google usando la **cuenta normal**. | Vuelves al juego con la sesión abierta; arriba aparece tu avatar o nombre. Si es la primera vez de esa cuenta, sale el mensaje de bienvenida: ciérralo. No sale ninguna pantalla de error ni un bucle de redirecciones a `/login`. |
| 3 | Ve a `/canjear`, pega el código de prueba y confírmalo. | Aparece el sobre cerrado. Lo tocas y se abre: salen las cartas con su imagen, nombre, Poder y los íconos de Género y Rasgo. No hay imágenes rotas ni textos en inglés o en voseo. |
| 4 | Vuelve a canjear **el mismo código**. | Lo rechaza con un mensaje claro en español (código ya usado). No te da otro sobre. |
| 5 | Ve a `/coleccion`. | Las cartas que acabas de abrir aparecen en la colección con la cantidad correcta. Abre una carta: el detalle se ve completo sobre fondo oscuro y el brillo pasa una vez al tocarla. |
| 6 | Ve a `/intercambios`. | La bandeja carga (vacía o con ofertas) sin error. |
| 7 | Desde `/intercambios`, entra a crear una oferta nueva (`/intercambios/nuevo`). | Carga el formulario con la lista de tus cartas y la forma de elegir al otro jugador (un contacto o su código de jugador). **No hace falta enviar la oferta**; si quieres probarla de punta a punta, hazlo con una segunda cuenta de prueba y verifica que la oferta llegue a su bandeja. |
| 8 | Cierra sesión y entra con la cuenta **admin**. Abre `/admin`. | Carga el panel con los totales (usuarios registrados, códigos canjeados, cartas en circulación, mazos, intercambios completados) y el menú de admin con todas sus secciones. |
| 9 | Con la cuenta admin abre `/admin/ajustes`. | Se ve el dorso, la plantilla, géneros y rasgos. **La sección «Reloj de pruebas» NO debe aparecer en producción.** Si aparece, detente: `NEXT_PUBLIC_APP_ENV` está mal puesta en producción. |
| 10 | Con la cuenta **normal**, intenta abrir `/admin`. | Te manda al inicio; no ves el panel. |

## Cierre

- Si los 10 pasos dieron el resultado esperado, el despliegue pasa la prueba de humo.
- Revisa en Vercel que el despliegue de producción esté en verde y que no haya
  errores nuevos en los logs de los últimos minutos.
- Si falló algo: no hagas correcciones a mano en la base de producción. Anota
  el paso y pídele a Claude la corrección como migración o commit nuevo.

## Dónde mirar cuando algo falla

- **Pantalla en blanco o error 500:** logs de la función en Vercel.
- **El canje o el intercambio fallan con un mensaje raro:** casi siempre es una
  migración que falta. Compara la huella del esquema de producción con la de
  Pruebas.
- **Las imágenes no cargan:** revisa que `NEXT_PUBLIC_SUPABASE_URL` del
  despliegue apunte al proyecto correcto.
