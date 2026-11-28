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

11. Votación "Próximas actualizaciones" (beta): **hecho y desplegado (commit `97a2547`), con la migración corrida en pruebas y en producción**. Solo está activa del 22 al 30 de noviembre de 2026 (hora de Madrid; fechas en `lib/config/vote.ts`), fuera de eso no se muestra nada y el código queda apagado. Jugador: ítem en el menú del avatar con puntico (también sobre el avatar), `/proximas` para ordenar con subir/bajar y texto "Otro", y un popup que espera al WelcomeModal y no sale en `/canjear`, `/admin`, durante la apertura de un sobre ni sobre otro modal. Admin: `/admin/votos` con resumen, posición promedio y primeros lugares por idea, textos "Otro", exportar CSV y editor de ideas (no se apaga por fecha). Las fechas están también en la función `save_vote_response`: si cambian, hay que cambiarlas en los dos lugares.
12. Favicon e iconos: **hecho y desplegado (commit `436cf9a`)**. El logo (`app/icon.png`, 174x174) es el favicon de la pestaña; el icono de iPhone y los de la app instalable (192 y 512) lo ponen sobre fondo `#eaeff4`. El de 512 está ampliado casi 2 veces: conviene reemplazar `app/icon.png` por una versión más grande o SVG cuando exista.
13. Entorno de pruebas: **hecho y desplegado (merge `799797a` en `main`, 2026-11-23)**. Reloj de pruebas, datos de ejemplo, guion de humo y huella del esquema. La prueba de humo de producción pasó completa (confirmado por ti).
   - Migración `20260920000000_test_clock`: columnas `game_settings.allow_test_clock` (false) y `test_clock_offset_minutes` (0), función `game_now()` (now() exacto salvo que `allow_test_clock` sea true) y `admin_set_test_clock(int)` (solo `service_role`; lanza error si el reloj está apagado). **Corrida en Pruebas y en producción (confirmado por ti).** Las funciones que ya existían (ventana de la votación, bans, vencimiento de intercambios) siguen con `now()`: este reloj no las mueve.
   - Pantalla: sección «Reloj de pruebas» en `/admin/ajustes`, visible solo con `NEXT_PUBLIC_APP_ENV=test` (hora simulada, hora real, avanzar 1 día / 7 días / 1 mes, volver a la hora real). Las Server Actions también se niegan fuera de ese entorno.
   - `supabase/seed-pruebas.sql`: datos de ejemplo idempotentes, solo para Pruebas (editar los tres correos de arriba).
   - `docs/prueba-de-humo.md`: guion de 10 minutos para después de cada paso a producción.
   - `.env.example` documenta las variables (`NEXT_PUBLIC_APP_ENV` incluida); `.gitignore` deja de ignorarlo.
   - `NEXT_PUBLIC_APP_ENV=test` está definida en Vercel solo para Preview; en Production no existe (confirmado por ti), así que «Reloj de pruebas» no aparece en producción.
   - Comparación de huellas Pruebas/producción (2026-11-23): las dos bases diferían solo en 2 funciones. `handle_new_user`: producción tenía la versión original porque nunca se había corrido `20260823010000_fix_handle_new_user_display_name`; ya se corrió en producción (los perfiles que ya quedaron con `display_name` NULL no se corrigieron, y las pantallas ya resuelven el nombre desde los datos de Google). `save_vote_response`: producción coincidía con el repo y Pruebas tenía otra versión; se volvió a pegar en Pruebas la versión exacta del repo (con sus comentarios, que también cuentan para la huella) y el código quedó igual al de producción (`ed98ca0c…`, confirmado por ti). Las dos bases quedaron alineadas.
   - CLAUDE.md: nueva sección «Entorno de pruebas y flujo de trabajo».
   - `supabase/huella-esquema.sql`: consulta de solo lectura que da un código (md5) por cada parte del esquema de `public`; se corre igual en Pruebas y producción y se comparan.
14. Acceso y aviso **hecho y desplegado (merge `3fd428a` en `main`, 2026-11-27)**: cerrar el juego con un cartel y desconectar a todos los jugadores.
   - Migración `20260921000000_access_notice`: seis columnas en `game_settings` (`access_mode`, `notice_title`, `notice_body`, `notice_text_color`, `notice_return_text`, `session_epoch`) y `get_public_access_state()` (solo esos seis campos; `anon` y `authenticated`). No crea tablas, no toca funciones sensibles ni políticas RLS. **Corrida en Pruebas y en producción (confirmado por ti); las huellas de las dos bases quedaron idénticas.** Ojo: `game_settings` ya era de lectura pública por una política previa, así que esas columnas también se leen con un select directo (inofensivo, no se cambió).
   - Modos: Abierto (como siempre), Aviso (cartel en `/login`, el login funciona) y Cerrado (`/login` sin botones y toda ruta del juego muestra el aviso, con o sin sesión, sin cerrar sesiones). Exentas: `/admin`, `/login`, `/acceso-equipo`, `/auth/*`, `/aviso` y los archivos de icono/manifiesto. Los admins nunca quedan bloqueados.
   - Cómo funciona: el middleware (`lib/supabase/middleware.ts`) lee el estado con caché en memoria de ~30 s y reescribe a `/aviso`; la decisión vive en `lib/access/decide.ts` (función pura, probada). Los Server Components usan `unstable_cache` con etiqueta, que se invalida al guardar. Cada instancia del middleware puede tardar hasta ~30 s en enterarse de un cambio. Si falla la lectura, todo queda abierto.
   - Desconexión forzada: `session_epoch` sube en 1 (botón con confirmación, o casilla al cerrar). `/auth/callback` guarda la época vigente en la cookie httpOnly `tcg_session_epoch`; si la cookie es menor (ausente = 0), el middleware cierra la sesión local y manda a `/login`. Los admins quedan exentos. No usa tablas de `auth`.
   - Admin: `/admin/portada/acceso` (pestaña «Acceso y aviso», lista para sumar «Fondo y textos» en `portada-tabs.tsx`), enlace «Portada» en el menú y banner en todo `/admin` mientras el modo no sea Abierto (amarillo en Aviso, rojo en Cerrado). En modo Aviso, los jugadores con sesión ven además una franja roja arriba con el título, el texto y el «volvemos…» del cartel (`components/access/player-notice-bar.tsx`; con colores fijos de la marca, no el color del cartel; se esconde en `/admin` y `/baneado`), porque ellos no pasan por `/login`. `/acceso-equipo` es el login del equipo (va a `/admin`; quien no es admin vuelve al aviso con la sesión intacta).
   - Probado en local contra un Supabase falso (3 modos, caída de lectura, época, cookie del callback, guardado, vista previa, desconexión) y luego a mano por ti contra Pruebas con login real: modo Aviso, modo Cerrado (visitante y jugador ven el aviso, el admin entra normal), acceso del equipo con un jugador no admin, volver a Abierto y desconexión forzada (el jugador vuelve a `/login`, el admin no): todo bien. Pruebas quedó en modo Abierto con `session_epoch` en 1 por esa prueba. En producción la prueba de humo pasó completa y se probaron Aviso y Cerrado: los jugadores con sesión siguen con la sesión abierta (esperado: cerrar el juego no desconecta a nadie, solo la desconexión forzada lo hace).
15. Portadas de temporada **hecho y desplegado (merge `42bcdd1` en `main`, 2026-11-28)**: imagen de fondo y texto personalizado para la pantalla de entrada.
   - Migración `20260922000000_splash_themes`: tabla `splash_themes` (RLS activado y sin ninguna política; GRANTs solo a `service_role`, nada para `anon` ni `authenticated`) y `get_active_splash()` (SECURITY DEFINER; `anon` y `authenticated`; devuelve solo los campos para dibujarla y usa `game_now()`). No toca funciones sensibles ni políticas existentes. **Corrida en Pruebas y en producción (confirmado por ti); las huellas de las dos bases quedaron idénticas (849 elementos).**
   - Storage: mismo bucket público `card-images`, carpeta `splash/` (sin bucket ni políticas nuevas). WebP, JPG o PNG, máximo 1 MB (tope duro en cliente y servidor); avisa sobre 500 KB; nombre único por archivo y caché de un año; al reemplazar, quitar o eliminar se borra la imagen anterior (nunca fuera de `splash/`, y no si otra portada la sigue usando). Duplicar copia también el archivo.
   - Admin: pestaña «Fondo y textos» en `/admin/portada/fondo` (lista con miniatura, interruptor de activa y estado; `nueva` y `[id]` para el formulario con selector de punto de enfoque por clic, oscurecido 0-80, título, texto, color y fechas de inicio y fin; vista previa en escritorio y celular a tamaño real escalado, con los botones de login encima).
   - Fechas: son de DÍA y se interpretan siempre en hora de Colombia (`America/Bogota`, `lib/utils/colombia-time.ts`), nunca con la zona del navegador ni la del servidor: el inicio cuenta desde las 00:00 de ese día y el fin cuenta el día completo, hasta las 23:59:59.999. La base no cambia (`get_active_splash()` compara `timestamptz` con `game_now()`). Probado en los bordes (23:59 y 00:00 de Bogotá el día del cambio) en la lógica y en la base, con la zona de la máquina cambiada. Ojo: el panel del reloj de pruebas (`/admin/ajustes`) y la votación (`lib/config/vote.ts`) siguen usando hora de Madrid; no se tocaron.
   - Pantalla de entrada: `/login` lee la portada con caché de ~30 s que se invalida al guardar. Sin portada vigente queda igual que antes. Con portada: `<img>` normal (sin `next/image`) con precarga, centrada en el enfoque y con capa oscura; título y texto de la portada (o los de siempre si no escribes) en el color elegido; botones sobre un respaldo semitransparente. Una portada sin imagen usa fondo azul casi negro. `/aviso` y `/login` en modo Cerrado usan la misma imagen de fondo (con el texto del aviso, no el de la portada).
   - Probado en local contra un Supabase falso (crear, reemplazar con borrado de la anterior, duplicar, eliminar, imagen compartida, avisos de peso, vista previa, `/login` y `/aviso` con y sin portada) y la batería de acceso y aviso repetida sin fallas. Después lo probaste tú contra Pruebas con Storage real (reemplazar borra la imagen anterior, duplicar y eliminar, fechas, apagar y encender, aviso Cerrado con la imagen de fondo) y se comprobó que la imagen se sirve con `cache-control: public, max-age=31536000`. En producción la prueba de humo pasó y el panel y `/login` se ven bien; todavía no hay ninguna portada creada allí.
16. Cierre del hueco de `user_cards_delete_own` (rama `fix/user-cards-delete-policy`, **probado en Pruebas; sin commit ni push todavía**): la policy permitía a un jugador con sesión borrar sus propias filas de `user_cards` desde el cliente, saltándose reservas de mazo y trades pendientes.
   - Migración `20260923000000_drop_user_cards_delete_policy`: solo `drop policy if exists user_cards_delete_own on public.user_cards`, en una transacción. No toca nada más. **Corrida en Pruebas (confirmado por ti); no corrida en producción todavía.** Antes se confirmó que la policy existía en Pruebas y después que solo quedó `user_cards_select_public`. Rollback en `supabase/rollback/user_cards_delete_rollback.sql` (recrea la policy idéntica a la de `20260823000000`; reabre el hueco, usarlo solo si la migración causa un problema real).
   - Revisión del código: ningún lugar borra `user_cards` con el cliente del navegador (todas las lecturas son `select`). Las cartas solo se mueven con funciones `SECURITY DEFINER` (`redeem_code`, `accept_trade`, `save_deck`, `decrease_user_card`, `delete_deck`) y borrar la cuenta limpia por `ON DELETE CASCADE`: ninguna de esas rutas pasa por la policy.
   - Probado en local con las 33 migraciones y los permisos por defecto de Supabase: antes, A borra su fila desde el cliente (el hueco); después, el mismo borrado no borra nada (0 filas, sin error) y la lectura pública sigue; canjear un código, guardar un mazo, proponer y aceptar un intercambio, borrar una cuenta y el rollback (idéntico al original, se puede repetir) funcionan. Efecto esperado en la huella: solo cambia `6 políticas RLS` (24 a 23) y el TOTAL (849 a 848).
   - Probado por ti en Pruebas: desde la consola del navegador con supabase-js y la cuenta A, el intento de borrar una fila propia de `user_cards` devolvió error nulo y 0 filas borradas (3 filas antes y 3 después); y siguen funcionando canjear un código, guardar un mazo y aceptar un intercambio. El borrado de cuenta no se probó en Pruebas (destructivo): solo en local.

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
| 20260919000000_next_updates_vote | Votación de próximas actualizaciones: `vote_options`, `vote_responses`, `save_vote_response`, con GRANTs. Corrida en pruebas y en producción (confirmado por ti, no verificable desde el código) |
| 20260920000000_test_clock | Reloj de pruebas: `allow_test_clock`, `test_clock_offset_minutes`, `game_now()`, `admin_set_test_clock()`. Corrida en Pruebas y en producción (confirmado por ti, no verificable desde el código) |
| 20260921000000_access_notice | Acceso y aviso: seis columnas en `game_settings` y `get_public_access_state()`. Corrida en Pruebas y en producción (confirmado por ti) |
| 20260922000000_splash_themes | Portadas de temporada: tabla `splash_themes` (solo `service_role`) y `get_active_splash()`. Corrida en Pruebas y en producción (confirmado por ti) |
| 20260923000000_drop_user_cards_delete_policy | Quita la policy `user_cards_delete_own`. Corrida en Pruebas; pendiente en producción |
