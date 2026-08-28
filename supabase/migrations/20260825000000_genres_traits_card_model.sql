-- ============================================================================
-- Corrección del modelo de cartas:
--  - Género y Rasgo pasan de texto libre a catálogos cerrados (genres,
--    traits), cada uno con su propia habilidad ya definida.
--  - Poder/Costo/Resistencia se unifican en un solo campo `power` (0-10).
--  - El dorso deja de ser por carta: pasa a game_settings (una fila única
--    para todo el juego).
--  - combat_stats queda sin uso (Género/Rasgo/Poder lo reemplazan) y se
--    elimina.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- TABLA: genres
-- Catálogo cerrado de 10 géneros. Cada uno tiene dos habilidades fijas:
-- la "base" (todas las cartas de ese género) y la "fandom" (versión más
-- fuerte, para cartas Fandom). El texto de la habilidad vive acá, no se
-- escribe a mano por carta.
-- ============================================================================

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  base_ability_name text not null,
  base_ability_text text not null,
  fandom_ability_name text not null,
  fandom_ability_text text not null
);

comment on table public.genres is 'Catálogo cerrado de géneros (10 filas fijas) con su habilidad base y fandom.';


-- ============================================================================
-- TABLA: traits
-- Catálogo cerrado de 5 rasgos, cada uno con una única habilidad fija.
-- ============================================================================

create table public.traits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  ability_name text not null,
  ability_text text not null
);

comment on table public.traits is 'Catálogo cerrado de rasgos (5 filas fijas) con su habilidad.';


-- ============================================================================
-- TABLA: game_settings
-- Fila única para todo el juego (el dorso es el mismo para todas las
-- cartas). `id boolean primary key default true` + el check de abajo es el
-- truco clásico de Postgres para forzar que la tabla tenga como máximo una
-- fila: la PK solo admite el valor `true`, así que un segundo insert
-- choca contra la unicidad de la PK.
-- ============================================================================

create table public.game_settings (
  id boolean primary key default true,
  card_back_screen_url text,
  card_back_print_url text,
  constraint game_settings_singleton check (id)
);

comment on table public.game_settings is 'Fila única de configuración global del juego (por ahora, el dorso de las cartas).';
comment on column public.game_settings.card_back_print_url is
  'Path dentro del bucket privado card-print (no una URL pública), igual que cards.print_front_url.';

insert into public.game_settings (id) values (true);


-- ============================================================================
-- Ajustes a cards
-- ============================================================================

-- El dorso ahora es único para todo el juego (game_settings), no por carta.
alter table public.cards drop column image_back_url;
alter table public.cards drop column print_back_url;

-- Tipo/costo/poder/resistencia/ability_text quedan reemplazados por
-- genre_id + trait_id (que ya traen su habilidad) + power. Nada más lee
-- combat_stats a esta altura, así que se elimina en vez de dejarlo muerto.
alter table public.cards drop column combat_stats;

-- Nullable a propósito: ya existe al menos una carta cargada con el modelo
-- viejo, que quedaría sin genre_id/trait_id/power. Se deja que la
-- aplicación (Server Action del admin) exija estos campos en cartas nuevas
-- o editadas, en vez de romper la migración por una fila existente.
alter table public.cards add column genre_id uuid references public.genres (id);
alter table public.cards add column trait_id uuid references public.traits (id);
alter table public.cards add column power integer check (power between 0 and 10);

create index idx_cards_genre_id on public.cards (genre_id);
create index idx_cards_trait_id on public.cards (trait_id);


-- ============================================================================
-- RLS: genres, traits y game_settings son de lectura pública (mismo patrón
-- que card_sets/cards/pack_types), solo escribibles por service_role.
-- ============================================================================

alter table public.genres enable row level security;
alter table public.traits enable row level security;
alter table public.game_settings enable row level security;

create policy genres_select_public
  on public.genres for select
  to anon, authenticated
  using (true);

create policy traits_select_public
  on public.traits for select
  to anon, authenticated
  using (true);

create policy game_settings_select_public
  on public.game_settings for select
  to anon, authenticated
  using (true);


-- ============================================================================
-- Seed: los 10 géneros y 5 rasgos, con su habilidad exacta.
-- ============================================================================

insert into public.genres
  (slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text)
values
  ('sci-fi', 'Sci-Fi', 1,
    'Escudo', '+1 Poder al defender en combate.',
    'Blindaje', '+3 Poder al defender en combate.'),
  ('fantasia', 'Fantasía', 2,
    'Hechizo', '+1 Poder al atacar en combate.',
    'Arcano', '+3 Poder al atacar en combate.'),
  ('comedia', 'Comedia', 3,
    'Set-Up', 'al entrar, le da su Género a otro aliado a tu elección hasta el final del turno.',
    'Remate', 'puedes elegir que tus cartas de Comedia ataquen juntas, sumando su Poder en un solo golpe. Si el ataque conjunto es bloqueado, tú repartes el daño recibido entre las cartas participantes.'),
  ('terror', 'Terror', 4,
    'Acecho', 'al atacar, si el rival decide bloquear, debe hacerlo con la carta que tú elijas (si está disponible).',
    'Pesadilla', 'inmune a habilidades rivales que la destruirían o le quitarían Poder, y no puede ser bloqueada por más de una carta a la vez.'),
  ('romance', 'Romance', 5,
    'Vínculo', 'si muere atacando, curas +1 PV.',
    'Idilio', 'si muere atacando y decides Exiliarla, curas +3 PV.'),
  ('drama', 'Drama', 6,
    'Sacrificio', 'cuando esta carta fuera a morir, puedes destruir a otro aliado tuyo en su lugar (esa carta destruida sí dispara sus propias habilidades Al morir).',
    'Catarsis', 'al morir, hace 3 PD directos al jugador rival o a una de sus unidades, tú eliges.'),
  ('aventura', 'Aventura', 7,
    'Trampa', 'al entrar, elige una carta rival y déjala Girada hasta el inicio del próximo turno de su dueño.',
    'Emboscada', 'al morir, devuelve la carta rival de menor Poder en mesa a la mano de su dueño (si hay empate, el rival elige cuál).'),
  ('accion', 'Acción', 8,
    'Adrenalina', 'puede atacar el mismo turno que la juegas (excepto en el Turno 1).',
    'Explosión', 'si al matar a una bloqueadora te sobra Poder, ese sobrante se suma como Poder temporal (hasta el final del turno) a otro aliado tuyo, a tu elección.'),
  ('documental', 'Documental', 9,
    'Investigar', 'al entrar, robas 1 carta de tu mazo.',
    'Archivo', 'al entrar, miras las 3 cartas superiores de tu mazo, te quedas con 2 y pones 1 en el fondo.'),
  ('musical', 'Musical', 10,
    'Eco', 'al morir, devuelve 1 carta al azar de tu descarte a tu mano.',
    'Encore', 'al morir o ser Exiliada, elige: devuelve 1 carta de tu descarte a tu mano (a tu elección) o, si tu Energía lo permite, juégala directo al campo sin pagar su coste.');

insert into public.traits
  (slug, name, sort_order, ability_name, ability_text)
values
  ('serie', 'Serie', 1,
    'Maratón', 'Cada carta Serie adicional que juegues el mismo turno cuesta 1 Energía menos que la anterior (acumulable hasta -3, sin bajar de 0), manteniendo su Poder original en mesa.'),
  ('pelicula', 'Película', 2,
    'Estreno', 'Al entrar al campo, elige una unidad enemiga y reduce su Poder a la mitad (redondeando hacia arriba) hasta el final del turno.'),
  ('videojuego', 'Videojuego', 3,
    'Level Up', 'Si esta carta sobrevive a un combate en el que destruyó a una unidad enemiga, gana +2 de Poder de forma permanente.'),
  ('animacion', 'Animación', 4,
    'Toon Force', 'Al defender, si su Poder es mayor al del atacante, no recibe daño de ese combate. Se activa una sola vez por carta en toda la partida.'),
  ('otro', 'Otro', 5,
    'Otros', 'Durante tu Fase Principal, puedes Sacrificar esta carta para ganar +2 de Energía disponible ese turno.');
