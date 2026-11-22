# Informe de estado del proyecto

Informe de solo lectura, generado el 2026-11-20 a partir del código y las migraciones del repositorio (rama `main`, commit `436cf9a`). No se cambió código, ni migraciones, ni la base de datos, y no se hizo commit ni push.

**Limitación importante:** no se pudo consultar ninguna base de datos real. El proyecto de Supabase de `.env.local` (`dguimetwwshozrecntru`, el de pruebas) ya no resuelve en DNS desde esta máquina (`ENOTFOUND`; el DNS general sí funciona). El proyecto de producción no está referenciado en el repositorio. Todo lo de "tablas" y "columnas" sale de reconstruir las 30 migraciones en orden, no de inspeccionar una base viva. No hay `supabase/config.toml` ni tabla de control de migraciones en el repositorio, así que **qué migraciones están aplicadas en cada proyecto no se puede saber desde el código**.

---

## 1. Estado de las actualizaciones

### 1.1 (portada, aviso, modos Abierto/Aviso/Cerrado, "Acceso del equipo"): **no existe**

- Búsqueda en el árbol de trabajo (`app`, `components`, `lib`, `middleware.ts`, SQL, Markdown) y en todo el historial (`git log --all -S"Acceso del equipo"` y `--grep` por portada, aviso, modo abierto, maintenance): cero resultados.
- No hay columna, tabla ni ajuste con modos de sitio. `game_settings` no tiene nada parecido (ver punto 6).
- `app/page.tsx` es solo un redirect: sin sesión manda a `/login?next=/coleccion`; con sesión muestra un título y un botón "Ir a mi colección". Es la única "portada" que hay.
- No hay ramas, stash ni tags con ese trabajo. Solo existe la rama `main`.
- Ojo: `supabase/migraciones-1.1.sql` **no** tiene relación. Es un paquete de conveniencia con las migraciones `20260914`, `20260915` y `20260916` (plantilla de arte de carta).

### 1.8 (pestaña "Próximas actualizaciones" y popup, 22 al 30 de noviembre): **sí está, en `main`**

- Commit `97a2547` (2026-10-27), ya subido. Archivos: `app/proximas/page.tsx`, `app/proximas/vote-form.tsx`, `app/admin/votos/{page,actions,vote-options-editor,export-csv-button}.tsx`, `components/votes/vote-prompt.tsx`, `components/providers/vote-status-provider.tsx`, `lib/config/vote.ts`, `supabase/migrations/20260919000000_next_updates_vote.sql`; cambios en `app/layout.tsx`, `components/auth/user-menu.tsx`, `components/admin/admin-nav.tsx`, `app/admin/page.tsx`, `lib/supabase/middleware.ts` (ruta protegida `/proximas`) y `lib/supabase/types.ts`.
- Fechas en `lib/config/vote.ts`: `VOTE_START = "2026-11-22"`, `VOTE_END = "2026-11-30"`, zona `Europe/Madrid`. La función SQL `save_vote_response` lleva **su propia copia** de las mismas dos fechas (`c_vote_start`, `c_vote_end`); si se cambian, hay que cambiarlas en los dos lugares.
- Hoy es 2026-11-20: la votación empieza en 2 días. Hasta entonces no se muestra nada.

### Rama de producción, commits y ramas sin subir

- Remoto: `https://github.com/estupidonerd/TCG.git`. Única rama: `main` (local) = `origin/main`, ambos en `436cf9a`. **0 commits sin subir. 0 ramas sin subir.** No se hizo `git fetch` para no tocar nada, así que `origin/main` es el último estado conocido localmente (el último fetch/push fue el del commit `436cf9a`); si alguien subió algo desde otra máquina, no se vería aquí.
- **Qué rama despliega Vercel no se puede confirmar desde el repositorio:** no hay `vercel.json` ni carpeta `.vercel`. `CLAUDE.md` dice "desplegado en Vercel". Lo habitual (y lo que se ha asumido en esta sesión) es que despliegue `main`.
- Sin commitear: `ESTADO.md` tiene 1 línea añadida (el punto 12, favicon, con el hash `436cf9a`). No hay archivos sin seguimiento.
- Últimos commits: `436cf9a` favicon real, `441b047` ESTADO.md, `97a2547` votación, `2a6934c` miniaturas del admin, `282e88c` relieve/foil/piel del sobre.

### Coherencia de `supabase/migrations`

- 30 archivos en disco, **idénticos a los de `HEAD`** (ninguno modificado ni sin seguimiento), con marcas de tiempo estrictamente crecientes de `20260823000000` a `20260919000000`.
- Paquetes de conveniencia: `supabase/migraciones-combinadas.sql` contiene 25 archivos (hasta `20260913000000_reset_all_progress`) y `supabase/migraciones-1.1.sql` contiene 3 (`20260914` a `20260916`). Comparé cada sección con su archivo fuente: **28 de 28 idénticas**. Sin paquete: `20260917000000_card_variants`, `20260918000000_pack_skin`, `20260919000000_next_updates_vote`.
- Error en `ESTADO.md`: dice que `migraciones-combinadas.sql` empaqueta "23 archivos"; son 25.

---

## 2. Cartas y sobres

### Columnas de `cards` (estado final tras todas las migraciones)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `set_id` | uuid NOT NULL | FK `card_sets(id)` (sin ON DELETE: no se puede borrar una expansión con cartas) |
| `slug` | text NOT NULL | único |
| `name` | text NOT NULL | |
| `description` | text | |
| `rarity` | `card_rarity` NOT NULL | enum, ver abajo |
| `image_front_url` | text | URL pública (bucket `card-images`) |
| `print_front_url` | text | ruta en el bucket privado `card-print` |
| `artist` | text | |
| `is_active` | boolean NOT NULL | default true |
| `released_at` | timestamptz | |
| `sort_order` | integer NOT NULL | default 0 |
| `genre_id`, `trait_id` | uuid | FK a `genres` / `traits`, nullable |
| `power` | integer | check 0 a 10, nullable |
| `score` | numeric(3,1) | check 0 a 10, nullable |
| `is_fandom` | boolean NOT NULL | default false |
| `use_card_name_as_display` | boolean NOT NULL | default true |
| `display_line_1`, `display_line_2`, `display_line_3` | text | |
| `chapter_info` | text | check `char_length <= 90` |
| `apply_art_template` | boolean NOT NULL | default true |
| `name_shadow_intensity` | smallint NOT NULL | default 50, check 0 a 100 |
| `name_font_size` | numeric NOT NULL | default 10 |
| `name_line_height` | numeric NOT NULL | default 110 |
| `variant_of` | uuid | FK `cards(id)` **ON DELETE SET NULL**, check `variant_of <> id`, índice parcial |

Columnas eliminadas por migraciones: `image_back_url`, `print_back_url`, `combat_stats` (el dorso es único en `game_settings`).

### Columnas de `pack_types`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text NOT NULL | |
| `cards_count` | integer NOT NULL | check `> 0` |
| `rarity_weights` | jsonb NOT NULL | check: tiene que ser un objeto |
| `allowed_set_ids` | uuid[] NOT NULL | default `'{}'`, **sin FK** (Postgres no permite FK en arreglos; se valida en la aplicación) |
| `guaranteed_rarity` | `card_rarity` | nullable |
| `image_url` | text | imagen especial del sobre (opcional) |
| `skin` | text NOT NULL | default `'normal'`, check `normal`/`dorado`/`tornasolado` |

No hay columna de precio, costo ni "se vende".

### Rareza

- **Enum de Postgres** `public.card_rarity` con valores exactos: `'comun'`, `'rara'`, `'epica'`, `'legendaria'` (sin tildes). Definido en `20260823000000_initial_schema.sql`; **nunca se alteró**. En TypeScript: `RARITIES`/`Rarity` en `lib/supabase/types.ts`.
- Cuidado: **no hay tabla de rarezas**. Agregar una rareza obliga a un `alter type ... add value` y a tocar el TypeScript.

### Pesos por tipo de sobre

- `pack_types.rarity_weights` (jsonb), por ejemplo `{"comun":70,"rara":20,"epica":8,"legendaria":2}`. No tienen que sumar 100 (son pesos relativos).
- `public.pick_weighted_rarity(jsonb)` suma los pesos, tira un número aleatorio y recorre los pesos acumulados. Si todos los pesos son 0, reparte parejo entre las 4 rarezas.
- `guaranteed_rarity` (opcional): `redeem_code` la aplica solo a la **primera** carta del sobre.
- Si no hay carta activa de la rareza sacada en los sets permitidos, `redeem_code` cae a cualquier carta activa de esos sets.

### Cuántas cartas entrega cada sobre

- `pack_types.cards_count` (entero positivo). `redeem_code` itera `1..cards_count`.
- `redeem_code(p_code text) returns jsonb` es la única fuente de cartas por canje. Última versión: `20260918000000_pack_skin.sql`.

### Cartas ocultas

- **Solo existe `variant_of`.** No hay columna `secreta`, `oculta` ni `hidden`. "Legendaria" es solo un valor de rareza y **no oculta nada**.
- Ocultamiento: en `app/coleccion/page.tsx` se filtra en el servidor `card.variant_of === null || card.quantity > 0`. Como el filtro se hace antes de pasar las cartas a `CollectionGrid`, esa carta no aparece ni en la grilla ni en `cards.length` ("X / Y cartas conseguidas") ni en el progreso por expansión (`progressBySet`, calculado desde ese mismo arreglo).
- **Huecos del ocultamiento** (hoy):
  - `/coleccion/[slug]` **no** revisa `variant_of`: una variante no conseguida se puede abrir escribiendo la URL (se ve el placeholder "?"). Solo exige `is_active`.
  - `redeem_code` **no excluye** variantes: entran en el sorteo por rareza igual que cualquier carta.
  - `/intercambios/nuevo` trae todas las cartas activas (`.eq("is_active", true)`) sin filtrar variantes (para armar lo que se pide).
  - Las estadísticas del admin (`cardsInCirculation`) no tienen relación con esto.

---

## 3. Borrado de cuentas

### Jugador: **existe**

- Enlace "Eliminar cuenta" en el menú del avatar (`components/auth/user-menu.tsx`) hacia `/cuenta/eliminar` (`page.tsx` + `delete-account-view.tsx`).
- Acción de servidor `deleteAccount(confirmText)` en `app/cuenta/eliminar/actions.ts`: exige sesión, exige escribir "Borrar" (se revalida en el servidor), y llama `admin.auth.admin.deleteUser(user.id)` con el cliente `service_role`. Después intenta `signOut` (si falla se ignora) y redirige a `/?cuenta_eliminada=1`, donde `app/page.tsx` muestra "Tu cuenta fue eliminada".
- La limpieza del resto depende de `ON DELETE CASCADE` (tabla siguiente). El comentario del código lista las tablas a mano: **una tabla nueva con usuario hay que agregarla con cascade y a ese comentario**.

### Admin: **no existe** borrado de cuentas

`/admin/usuarios` (`app/admin/usuarios/page.tsx`, `users-table.tsx`, `actions.ts`) solo lista jugadores (RPC `admin_list_players`, ejecutable solo por `service_role`) y permite **banear** (`banPlayer(userId, days)`) y **desbanear** (`unbanPlayer`). No hay acción de eliminar.

### Tablas con usuario o FK a `auth.users`

| Tabla | Columna(s) | ON DELETE |
|---|---|---|
| `profiles` | `id` (PK, FK `auth.users`) | CASCADE |
| `redemptions` | `user_id` | CASCADE (`code_id` → `codes`, sin cascade) |
| `user_cards` | `user_id` (PK compuesta con `card_id`) | CASCADE |
| `trades` | `sender_id`, `receiver_id` | CASCADE (los dos) |
| `trade_items` | `user_id` (y `trade_id` → `trades`) | CASCADE (los dos) |
| `contacts` | `user_id`, `contact_user_id` | CASCADE (los dos) |
| `decks` | `user_id` | CASCADE |
| `deck_cards` | (sin usuario; `deck_id` → `decks`) | CASCADE por `decks` |
| `feedback` | `user_id` | CASCADE (originalmente SET NULL; cambiado en `20260909000000`) |
| `blocked_users` | `blocker_id`, `blocked_id` | CASCADE (los dos) |
| `vote_responses` | `user_id` (PK) | CASCADE |

Sin usuario: `card_sets`, `cards`, `genres`, `traits`, `pack_types`, `codes`, `game_settings`, `vote_options`.

### Archivos de Storage de un usuario: **ninguno**

- Buckets: `card-images` (público, lectura para `anon`/`authenticated`) y `card-print` (privado, sin ninguna policy). Ninguno tiene policy de escritura para `anon`/`authenticated`: toda subida pasa por Server Actions de admin con `service_role` (`app/admin/{ajustes,cards,packs}/actions.ts`).
- Lo que se sube es del juego (imágenes de carta, sobres, dorsos, marco, íconos de género/rasgo, fuente del nombre), no de un jugador.
- `profiles.avatar_url` es la URL de la foto del proveedor de login (Google, etc.); no se sube ningún archivo.

---

## 4. Intercambios

### `accept_trade`

- Firma: `public.accept_trade(p_trade_id uuid) returns void`, `LANGUAGE plpgsql`, `SECURITY DEFINER`, `set search_path = public`; `revoke all ... from public`; `grant execute ... to authenticated`.
- Última definición: `supabase/migrations/20260909000000_accounts_blocking_bans.sql:654`. Se llama desde `app/intercambios/trade-inbox.tsx` con `supabase.rpc("accept_trade", { p_trade_id })`.
- Hace: exige sesión; rechaza si `is_banned`; bloquea la fila del trade (`for update`); solo el **receptor** puede aceptar; debe estar `pendiente`; si `expires_at < now()` lo marca `expirado` y falla; por cada `trade_items` (ordenado por `card_id, user_id`) verifica `quantity` y `public_quantity` suficientes y mueve con `decrease_user_card` / `increase_user_card`; marca `aceptado` con `resolved_at = now()`.
- Funciones hermanas: `create_trade(p_receiver_id uuid, p_message text, p_offer jsonb, p_request jsonb) returns uuid` (última en `20260912000000_tuteo_fixes.sql`, fija `expires_at = now() + interval '7 days'`), `reject_trade(uuid)`, `cancel_trade(uuid)`, `expire_old_trades()`, `clear_trade_history()`.

### Tablas

- `trades`: `id`, `sender_id`, `receiver_id`, `status` (enum `trade_status`: `pendiente`, `aceptado`, `rechazado`, `cancelado`, `expirado`), `message`, `created_at`, `resolved_at`, `expires_at`, `hidden_by_sender` (bool), `hidden_by_receiver` (bool); check `sender_id <> receiver_id`.
- `trade_items`: `id`, `trade_id`, `user_id` (de quién es la carta), `card_id`, `quantity > 0`.
- Relacionadas: `contacts`, `blocked_users` (bloquear cancela los pendientes entre los dos).

### Historial

- **Sí se guarda**: los trades resueltos quedan con su estado y `resolved_at`. "Borrar historial" (`clear_trade_history`) solo pone `hidden_by_sender` / `hidden_by_receiver` en `true` para el que lo pide; la fila no se borra.
- El vencimiento es **perezoso, sin cron**: `expire_old_trades()` se llama al cargar `/intercambios`, y `accept_trade` también lo revisa. No hay `pg_cron` ni cron de Vercel.

### Qué pasa hoy si un usuario desaparece con un intercambio abierto

- Al borrar el `auth.users`, `trades.sender_id` / `receiver_id` tienen CASCADE: **se borran todos los trades en los que participaba, incluidos los ya aceptados**, y por cascada sus `trade_items`. Para la otra persona: el pendiente desaparece sin aviso y el historial de intercambios aceptados con esa cuenta también.
- Las cartas ya transferidas **no** vuelven (viven en `user_cards` de cada uno). La reserva de un pendiente se calcula desde `trade_items` de trades `pendiente`, así que se libera sola.
- Un usuario **baneado** (no borrado) no desaparece: sus pendientes siguen hasta vencer a los 7 días, y mientras tanto él no puede aceptar ni crear (`is_banned`).

---

## 5. Mazos

- Se crea **con función, no con insert del cliente**: `supabase.rpc("save_deck", { p_deck_id, p_name, p_cards })` desde `app/mazos/decks-list.tsx` y `app/mazos/deck-builder.tsx`. `decks` y `deck_cards` solo tienen policy de `select` (propios); no hay policy de insert/update/delete.
- `save_deck(p_deck_id uuid, p_name text, p_cards jsonb) returns uuid`, `SECURITY DEFINER`; última versión en `20260912000000_tuteo_fixes.sql:200`. Sin `p_deck_id` crea el mazo.
- **Límite: 3 mazos por jugador.** `if v_deck_count >= 3 then raise exception 'Ya tienes 3 mazos. Borra alguno antes de crear uno nuevo.'`. Solo se aplica al crear. Un mazo está completo (`is_complete`) con exactamente 40 cartas. También exige que cada carta del arreglo sea única, que el jugador tenga las copias, y limita las copias por carta según `power`: power 0 sin límite, power 10 una sola copia, el resto máximo 3 (un `power` nulo cae en el "resto", es decir 3).
- `delete_deck(p_deck_id uuid, p_release_unused boolean default false)` y `release_unused_reservation(uuid)` completan el flujo.

---

## 6. Ajustes (`game_settings`)

- **Columnas, no clave-valor.** Fila única: `id boolean primary key default true` con `check (id)`.
- Columnas hoy: `id`, `card_back_screen_url`, `card_back_print_url` (ruta en bucket privado `card-print`), `pack_image_url`, `card_template` (jsonb: marco, zona de nombre, tamaños de íconos y de Poder/Score, offsets), `postal_back_print_url` (ruta en `card-print`), `card_name_font_url`.
- Lectura: la leen jugadores y admin con el cliente normal; la escritura la hace solo `/admin/ajustes` con `service_role`.
- No hay columnas para modos de sitio, monedas, tienda, reto diario ni fechas.

---

## 7. Admin

- **Cómo se comprueba `is_admin`:** columna `profiles.is_admin boolean not null default false`. `authenticated` solo puede hacer UPDATE de `display_name`, `avatar_url`, `trade_default` y `has_seen_welcome` (grants por columna), así que no puede darse admin a sí mismo. Del lado del servidor: `requireAdminOrRedirect()` en `app/admin/layout.tsx` (y repetido en las páginas que leen con `service_role`) y `requireAdmin()` al inicio de **cada** Server Action (`lib/admin/require-admin.ts`). `lib/supabase/admin.ts` es `server-only`. No hay comprobación de `is_admin` dentro de SQL (las RPC de admin se limitan a `service_role`).
- **`/admin/usuarios` existe.**

| Ruta | Qué hace |
|---|---|
| `/admin` | Panel: usuarios registrados, códigos canjeados/generados, cartas en circulación, mazos guardados, intercambios completados, y enlaces a las secciones |
| `/admin/sets`, `/new`, `/[id]` | Crear y editar expansiones |
| `/admin/cards`, `/new`, `/[id]` | Catálogo (filtro, búsqueda, agrupado por expansión, orden); crear y editar carta: imágenes, Género, Rasgo, Poder, Score, textos de arte, variante |
| `/admin/packs`, `/new`, `/[id]` | Tipos de sobre: cantidad de cartas, pesos por rareza, rareza garantizada, sets permitidos, imagen y piel |
| `/admin/codes` | Generar lotes de códigos |
| `/admin/codes/stats` | Estadísticas de canjes por lote; activar/desactivar y borrar códigos o lotes |
| `/admin/usuarios` | Buscar jugadores y banear/desbanear temporalmente (días) |
| `/admin/feedback` | Lista del feedback de jugadores |
| `/admin/votos` | Resultados de la votación, textos "Otro", CSV y editor de ideas |
| `/admin/ajustes` | Dorso único (pantalla e impresión, y postal), imagen base de sobre, fuente del nombre, plantilla de arte (marco, tamaños), íconos y colores de Géneros y Rasgos |

La navegación del admin está duplicada: `LINKS` en `components/admin/admin-nav.tsx` y `SECTIONS` en `app/admin/page.tsx`.

---

## 8. Fechas

### SQL

- Casi todo es `now()` / `timestamptz` y no asume zona (`timestamptz` guarda UTC). **El repositorio no fija la zona horaria de la sesión de Postgres**; se asume el valor por defecto de Supabase (UTC), sin comprobarlo.
- `current_date` (depende de la zona de la sesión): `is_banned()` y `banned_until` (columna `date`): `banned_until > current_date`.
- Vencimiento de trades: `now() + interval '7 days'`; `expire_old_trades()` y `accept_trade` comparan con `now()` (lazy, sin cron).
- Vencimiento de códigos: `codes.expires_at < now()` en `redeem_code`.
- **Única zona explícita:** `save_vote_response` usa `(now() at time zone 'Europe/Madrid')::date`, con las constantes `2026-11-22` y `2026-11-30`.

### TypeScript

- **UTC** para baneos: `app/admin/usuarios/actions.ts` (`bannedUntilInDays`, `Date.UTC`), `lib/supabase/middleware.ts:81`, `app/baneado/page.tsx`, `app/admin/usuarios/users-table.tsx` (todos `toISOString().slice(0,10)`, y formato con `timeZone: "UTC"`). Coincide con `current_date` solo si la base está en UTC.
- **Europe/Madrid** solo en `lib/config/vote.ts` (`isVoteOpen`, `madridToday`), usado en `app/layout.tsx`, `app/proximas/page.tsx`, `components/votes/vote-prompt.tsx`.
- Visualización: `toLocaleString`/`toLocaleDateString` con `es-CO` (hora del navegador del usuario, o la del servidor en Server Components, normalmente UTC en Vercel; no verificado) y en dos sitios `es-AR` (`app/admin/sets/page.tsx`, `app/admin/codes/stats/batch-card.tsx`; inconsistencia con el resto, que es es-CO).
- `app/admin/codes/actions.ts:54` nombra lotes con `new Date().toISOString().slice(0,10)` (UTC). `components/nav/trade-badge.tsx:32` usa la hora del navegador para filtrar trades vencidos.

---

## 9. Dónde se dibujan el dorso y el marco

### Dorso en pantalla (`game_settings.card_back_screen_url`)

- `components/coleccion/card-detail.tsx` (cara trasera del giro; recibe `cardBackUrl` desde `app/coleccion/[slug]/page.tsx`).
- `components/canjear/flip-card.tsx` (dorso de cada carta antes de revelarla; viene de `app/canjear/page.tsx` → `redeem-form.tsx` → `pack-opening.tsx`).

### Dorso en impresión (bucket privado `card-print`, URLs firmadas)

- `app/imprimir/actions.ts`: `getPrintAssets` firma `card_back_print_url` y `postal_back_print_url`.
- `components/imprimir/print-block.tsx` (+ `print-sheet.tsx`): bloque 63 x 176 mm, dorso arriba rotado 180 grados (`transform: rotate(180deg)`, línea 133), frente abajo.
- `components/imprimir/postal-block.tsx` (+ `postal-sheet.tsx`): postal 100 x 150 mm, frente y dorso lado a lado (bloque de 200 x 150 mm), usa `postal_back_print_url`.

### Marco (`game_settings.card_template.marco_url`, bucket público `card-images`)

- Se dibuja en `components/cards/card-art-overlay.tsx` (línea 95, `showFrameAndStats && template.marco_url`, en las variantes `coleccion` e `impresion`; la `postal` no lo lleva). Ese componente también dibuja íconos, nombre, Poder y Score.
- Se monta en: `components/coleccion/collection-card-tile.tsx`, `components/coleccion/card-detail.tsx`, `components/canjear/flip-card.tsx`, `components/trades/card-picker-grid.tsx`, `components/trades/trade-accept-animation.tsx`, `components/mazos/deck-row.tsx`, `app/intercambios/trade-inbox.tsx`, `components/imprimir/print-block.tsx`, `components/imprimir/postal-block.tsx`, `app/imprimir/print-studio.tsx`, y las vistas previas de `app/admin/cards/card-form.tsx` y `app/admin/ajustes/card-template-form.tsx`.
- Datos: `lib/supabase/card-art.ts` (`getCardArtContext`) y `lib/supabase/types.ts` (`CardTemplate`).
- Se edita en `/admin/ajustes` (`card-template-form.tsx`, acción `updateCardTemplate`).

---

## 10. Pruebas

- **No hay `seed.sql`** ni cuentas de prueba definidas, ni `supabase/config.toml`, ni `.env.example` (solo `.env.local`, no versionado). No hay tests automatizados (ni archivos `*.test.*`/`*.spec.*`, ni script `test` en `package.json`); la verificación es `tsc`, `eslint` y `next build`. El `README.md` (36 líneas) no menciona base de datos, migraciones ni pruebas.
- El único proyecto de pruebas referenciado (`dguimetwwshozrecntru`) **no responde hoy** (ver arriba). Por tanto el flujo local contra ese proyecto no funciona hasta que se apunte `.env.local` a otro.
- **`CLAUDE.md` existe**. Reglas hoy: stack (Next.js 15 App Router, TypeScript, Tailwind, Framer Motion, Supabase, Vercel); dominio `tcg.estupidonerd.com`; reglas de diseño (Poder = Coste = Resistencia, escala 0 a 10; Género y Rasgo como catálogos cerrados; la habilidad se deriva de Género y Rasgo; dorso único en `game_settings`); innegociables (cartas son datos; toda lógica que otorgue o mueva cartas vive en funciones `SECURITY DEFINER` con transacciones; `codes` no legible; `service_role` nunca al navegador; mobile-first; animaciones con `prefers-reduced-motion`; texto en tuteo colombiano, nunca voseo); **reglas de base de datos** (desde el 30-oct-2026, GRANT explícitos en toda migración que cree una tabla; RLS obligatorio además); identidad de marca (Titillium Web, paleta de 5 colores); medidas de impresión (63 x 88 mm; bloque 63 x 176 mm); y "al terminar cualquier tarea, actualiza `ESTADO.md`".

---

## 11. Lo que puede chocar con monedas, tienda, forja y reto diario

1. **Seguridad actual de `user_cards`:** la policy `user_cards_delete_own` (`20260823000000`) **nunca se eliminó** (en `20260826000000` se eliminaron solo las de insert y update). Un jugador autenticado puede borrar directamente sus propias filas de `user_cards` desde el cliente, saltándose las reservas de mazo y los trades. No da monedas por sí solo, pero **una forja o venta no puede apoyarse en que la colección esté protegida**: conviene cerrar esa policy antes. Es un hallazgo desde las migraciones, no verificado en una base viva.
2. **`user_cards.public_quantity`** tiene un check `public_quantity <= quantity - 1`, y `decrease_user_card` / `increase_user_card` / `deck_reserved_quantity` mantienen esa invariante junto con las reservas de mazo. Cualquier forja, venta o consumo de cartas tiene que pasar por `decrease_user_card` (no por un `delete`/`update` directo) y respetar la reserva de mazos y lo comprometido en trades pendientes. `user_cards.quantity > 0` por constraint (la fila se borra al llegar a 0).
3. **No existe columna ni tabla de monedas**, de precios ni de catálogo de tienda. `pack_types` no tiene precio ni disponibilidad. Los sobres hoy **solo** se obtienen con códigos (`codes` → `redeem_code`).
4. **La lógica de sorteo de un sobre está dentro de `redeem_code`**, que se ha reescrito entero ~10 veces (patrón del proyecto: nunca `ALTER FUNCTION`, siempre `CREATE OR REPLACE` con el cuerpo completo). Una tienda que venda sobres necesita reutilizar ese sorteo: habría que extraerlo a una función propia o duplicarlo.
5. **`redeem_code` usa `order by random() limit 1` dos veces por carta del sobre** (escaneo + orden completo sobre `cards`), y `save_deck` hace hasta ~120 consultas por guardado. Una tienda o un reto diario que multipliquen aperturas lo harían más notorio (auditoría de rendimiento del 2026-10-27, sin cambios desde entonces).
6. **Reto diario y zonas horarias:** hoy conviven UTC (baneos, `current_date`, lotes) y `Europe/Madrid` (votación), y la zona de la base no está fijada en el repositorio. Un "día" de reto necesita decidir una sola zona y una sola fuente (SQL), y como no hay cron (todo es vencimiento perezoso, p. ej. `expire_old_trades()`), un reinicio diario tendría que ser también perezoso (calcular "¿ya cobró hoy?" al consultar) o añadir un cron.
7. **Borrado de cuenta:** toda tabla nueva con usuario (saldo, historial de movimientos, progreso del reto, forjas) debe llevar `on delete cascade` hacia `auth.users` y sumarse al comentario de `app/cuenta/eliminar/actions.ts`. El cascade de `trades` borra también el historial de la otra persona (ver punto 4); un libro de movimientos de monedas que referencie a otro jugador heredaría el mismo problema.
8. **`reset_all_progress`** (`20260913000000`, no tiene botón en la interfaz; se corría a mano) borra `trade_items`, `trades`, `deck_cards`, `decks`, `redemptions`, `user_cards` y pone `codes.uses_count = 0`. Si hay monedas o forjas, habría que decidir si entran en el reinicio.
9. **Reglas de la base:** las tablas nuevas necesitan sus GRANT explícitos en la misma migración (regla de `CLAUDE.md`); como los jugadores no escriben directo, el patrón de la votación (SELECT propio + escritura solo por función `SECURITY DEFINER`, nada de INSERT/UPDATE/DELETE para `authenticated`) es el que corresponde.
10. **Perfil en el cliente:** `components/providers/user-provider.tsx` carga un `select` fijo de `profiles` (`id, display_name, player_code, avatar_url, created_at`); un saldo mostrado en el menú o la cabecera necesita ampliar esa lista y el tipo `Profile`. Tras una operación de monedas habría que refrescar (`router.refresh()`), como hace el WelcomeModal.
11. **Rarezas:** `card_rarity` es un enum de 4 valores con los mismos nombres como claves de `rarity_weights`. Una forja que mejore la rareza debe seguir ese orden fijo (`comun` < `rara` < `epica` < `legendaria`); no existe una columna de orden de rareza, solo el orden del enum y de la constante `RARITIES`.
12. **Variantes y forja/tienda:** una variante sigue entrando en el sorteo (punto 2) y se puede abrir por URL aunque no se tenga (punto 2). Si la tienda o la forja las tratan como especiales, hay que decidir esas reglas explícitamente.
13. **Admin:** cada sección nueva exige entrada en `LINKS` (`admin-nav.tsx`) y en `SECTIONS` (`app/admin/page.tsx`), `requireAdminOrRedirect()` en la página y `requireAdmin()` en cada acción.
14. **Modo Abierto/Aviso/Cerrado (1.1):** si se construye, no hay dónde colgarlo: ni columna en `game_settings` ni nada en el middleware. El middleware (`lib/supabase/middleware.ts`) ya hace 1 o 2 consultas por navegación (`getUser` + `profiles.banned_until`); un modo de sitio guardado en la base añadiría otra, salvo que se resuelva junto al chequeo de baneo.

---

## Resumen

**Lo que hay:**
- La votación de próximas actualizaciones (1.8) está completa y subida en `main` (`97a2547`); se activa sola el 22 de noviembre. Todo el repositorio está subido: 0 commits sin subir, una sola rama, y solo `ESTADO.md` con 1 línea sin commitear.
- Las 30 migraciones coinciden con `HEAD` y con sus dos paquetes de conveniencia (28 de 28 secciones idénticas).
- Esquema coherente: `rarity` es un enum de 4 valores; los pesos están en `pack_types.rarity_weights` (jsonb); la cantidad por sobre en `pack_types.cards_count`; las cartas ocultas se marcan solo con `variant_of`.
- Borrado de cuenta del jugador funcional (acción `deleteAccount` + `auth.admin.deleteUser`, cascade en 11 tablas, sin archivos de Storage de usuario). Mazos por RPC con límite de 3. `game_settings` es de columnas. Rutas de admin documentadas y `is_admin` verificado del lado del servidor en cada acción.

**Lo que no existe:**
- La versión 1.1 completa (portada, aviso, modos Abierto/Aviso/Cerrado, "Acceso del equipo"): ni código, ni migración, ni rama, ni historial.
- Borrado de cuentas por parte del admin.
- Monedas, tienda, forja y reto diario: ni tablas, ni columnas, ni pantallas, ni precio en `pack_types`.
- `seed.sql`, cuentas de prueba, tests automatizados, `supabase/config.toml`, `.env.example`, y `vercel.json` (no se puede confirmar qué rama despliega Vercel).
- Una tabla de rarezas, columna de "secreta/oculta" y orden de rareza numérico.

**Lo que conviene saber antes de seguir:**
- El proyecto de pruebas de `.env.local` ya no responde (DNS): no se pudo comprobar nada contra una base real, y qué migraciones están aplicadas en pruebas o producción solo lo sabes tú.
- `user_cards_delete_own` sigue vigente: un jugador puede borrar sus propias cartas desde el cliente (hallazgo desde las migraciones).
- Una variante no conseguida se puede abrir por URL y entra en el sorteo de sobres.
- Borrar una cuenta borra también los intercambios (incluidos los aceptados) de la otra persona.
- `ESTADO.md` dice "23 archivos" en el paquete combinado; son 25.
