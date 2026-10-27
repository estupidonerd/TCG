# Estado del proyecto

Revisado contra el código real el 2026-10-15 (commit `2a6934c`); punto 11 y última migración agregados el 2026-10-27. "Funcionando" significa que el código está completo y compila (tsc, lint y build limpios); las pantallas con login no se probaron a ojo en ese chequeo.

## Funcionalidades

1. Tienda central de intercambios: **no existe**. Hay intercambio persona a persona (`/intercambios`: bandeja, crear oferta eligiendo un contacto o buscando por código de jugador, `accept_trade`/`reject_trade`/`cancel_trade`, privacidad con `public_quantity`, reserva de mazos), pero ninguna pantalla ni tabla de mercado común donde se publiquen o exploren cartas.
2. Impresión de cartas y postal 10x15 con su dorso: **hecho y funcionando**. `/imprimir` alterna entre "Imprimir carta" (bloque 63x176 mm) y "Imprimir postal" (`postal-block.tsx`/`postal-sheet.tsx`, 100x150 mm con el dorso al lado, crédito en el reverso).
3. Generador de nombre, marco, íconos, Poder y Score sobre la carta: **hecho y funcionando**. `CardArtOverlay` se usa en colección, detalle, sobre, intercambios, mazos, impresión y postal; la plantilla, los íconos/colores por Género y Rasgo y los textos por carta se editan en `/admin/ajustes` y `/admin/cards`.
4. Medallas (tablas, /admin/medallas, animación de entrega): **no existe**. No hay tabla, ruta ni componente; las únicas coincidencias de "badge" son insignias de rareza y el contador de intercambios.
5. Editor de cartas en masa: **no existe**. `/admin/cards` solo edita una carta a la vez (`createCard`/`updateCard`); la lista tiene filtros, búsqueda y orden, pero ninguna selección múltiple ni acción en lote.
6. Cartas variante y su ocultamiento en la colección: **hecho y funcionando**. `cards.variant_of` con selector de carta base y prellenado en el admin; `/coleccion` oculta (ni siquiera como silueta) la variante que el jugador no tiene.
7. Relieve, foil y animación de apertura de sobre: **hecho a medias**.
   - Relieve (`.card-relief`): solo en la grilla de colección, el detalle y las cartas reveladas de `/canjear`. Falta en el selector de intercambios, la animación de aceptar intercambio, las filas de mazos y la selección de `/imprimir`.
   - Foil: hecho en colección, detalle y cartas reveladas (un solo barrido al pasar el mouse o tocar; plata/cobre/dorado/tornasolado).
   - Apertura de sobre: sigue la animación sencilla de antes (el sobre rebota, se toca y salen las cartas); la coreografía detallada se descartó.
   - Piel del sobre: la columna `pack_types.skin` y su selector en `/admin/sobres` existen, pero el sobre cerrado no la muestra.
8. Modo oscuro: **no existe**. No hay variantes `dark:`, ni `prefers-color-scheme`, ni selector de tema.
9. Duelos o base de datos o pantalla preparada para ellos: **hecho a medias**. `/duelos` es una pantalla "Próximamente" con enlace en la barra; no hay tablas ni funciones de duelo. Lo más cercano son los mazos (`decks`, `deck_cards`, `save_deck`), que sí funcionan.
10. Estadísticas, botón de feedback y bienvenida al primer login: **hecho y funcionando**. Panel `/admin` con totales y `/admin/codes/stats` (canjes por lote); botón flotante de feedback con modal y bandeja en `/admin/feedback`; `WelcomeModal` controlado por `profiles.has_seen_welcome`.

11. Votación "Próximas actualizaciones" (beta): **hecho, pendiente de correr la migración en pruebas**. Solo está activa del 22 al 30 de noviembre de 2026 (hora de Madrid; fechas en `lib/config/vote.ts`), fuera de eso no se muestra nada y el código queda apagado. Jugador: ítem en el menú del avatar con puntico (también sobre el avatar), `/proximas` para ordenar con subir/bajar y texto "Otro", y un popup que espera al WelcomeModal y no sale en `/canjear`, `/admin`, durante la apertura de un sobre ni sobre otro modal. Admin: `/admin/votos` con resumen, posición promedio y primeros lugares por idea, textos "Otro", exportar CSV y editor de ideas (no se apaga por fecha). Las fechas están también en la función `save_vote_response`: si cambian, hay que cambiarlas en los dos lugares.

## Migraciones (`supabase/migrations/`)

El repositorio no dice en qué proyecto de Supabase se corrió cada una; esa información solo la tienes tú. Lo que sí se ve en el repo:

- `.env.local` apunta al proyecto de pruebas (`dguimetwwshozrecntru`).
- `supabase/migraciones-combinadas.sql` empaqueta de `20260823000000_initial_schema` a `20260913000000_reset_all_progress` (23 archivos), armado para pegar de una sola vez.
- `supabase/migraciones-1.1.sql` empaqueta `20260914000000_card_art_template`, `20260915000000_card_art_template_fixes` y `20260916000000_card_name_size_per_card`.
- `20260917000000_card_variants` y `20260918000000_pack_skin` van sueltas, sin paquete.

Según lo que me dijiste durante las sesiones (no se puede comprobar desde el código): las combinadas y las posteriores hasta `pack_skin` las pegaste en el SQL Editor. Las de la plantilla de arte (`20260914` a `20260916`) se probaron primero en el proyecto de pruebas. Si `pack_skin` y las dos de variantes y plantilla están también en producción, confírmalo corriendo en producción: `select column_name from information_schema.columns where table_name = 'pack_types' and column_name = 'skin';`.

Listado completo, en orden:

| Migración | Qué hace |
|---|---|
| 20260823000000_initial_schema | Esquema base |
| 20260823010000_fix_handle_new_user_display_name | Corrección de nombre al crear usuario |
| 20260823020000_admin_and_storage | Admin y almacenamiento |
| 20260825000000_genres_traits_card_model | Géneros, rasgos y modelo de carta |
| 20260826000000_redeem_code | Canje de códigos |
| 20260827000000_pack_images | Imágenes de sobre |
| 20260828000000_card_score | Puntaje |
| 20260828010000_card_score_decimal | Puntaje decimal |
| 20260829000000_card_is_fandom | Marca Fandom |
| 20260830000000_trades_and_contacts | Intercambios y contactos |
| 20260831000000_public_profile_names | Nombres públicos |
| 20260901000000_trade_privacy | Privacidad de intercambio |
| 20260902000000_trade_keep_one_copy | Siempre queda una copia |
| 20260903000000_trade_history_clear | Limpiar historial |
| 20260904000000_decks | Mazos |
| 20260905000000_decks_protect_on_gain | Protección de mazos al ganar cartas |
| 20260906000000_trades_respect_deck_reservation | Intercambios respetan reserva |
| 20260907000000_feedback | Feedback |
| 20260907010000_profile_welcome | Bienvenida |
| 20260908000000_privacy_respects_decks | Privacidad y mazos |
| 20260909000000_accounts_blocking_bans | Bloqueos y baneos |
| 20260910000000_admin_players_display_name | Nombre en lista de jugadores |
| 20260911000000_fix_release_unused_reservation | Corrección de reserva |
| 20260912000000_tuteo_fixes | Textos en tuteo |
| 20260913000000_reset_all_progress | Reinicio de progreso |
| 20260914000000_card_art_template | Plantilla de arte |
| 20260915000000_card_art_template_fixes | Ajustes de la plantilla |
| 20260916000000_card_name_size_per_card | Tamaño de nombre por carta |
| 20260917000000_card_variants | Cartas variante |
| 20260918000000_pack_skin | Piel del sobre y `variant_of`/`skin` en `redeem_code` |
| 20260919000000_next_updates_vote | Votación de próximas actualizaciones: `vote_options`, `vote_responses`, `save_vote_response`, con GRANTs. Sin correr todavía (primero en pruebas) |
