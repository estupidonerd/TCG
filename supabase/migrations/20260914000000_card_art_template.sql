-- ============================================================================
-- PLANTILLA DE ARTE SOBRE LAS CARTAS -- catálogo de color/ícono por Género y
-- Rasgo, plantilla general de composición (marco, zonas, tamaños, todo en
-- porcentaje) en game_settings, y texto de arte por carta (nombre custom o
-- líneas propias + chapter_info).
--
-- Todo aditivo: no renombra, elimina ni cambia el tipo de ninguna columna
-- existente. Confirmado contra el proyecto de pruebas antes de escribir esto
-- que ninguna de estas columnas existe todavía.
--
-- chapter_info: el límite de 90 caracteres del check de abajo viene de medir
-- con la tipografía real (Titillium Web) cuánto texto entra en el ancho real
-- de impresión (57mm = 63mm de carta menos 3mm de margen de seguridad a cada
-- lado, el mismo ART_W_MM que ya usa components/imprimir/print-block.tsx) a
-- 8pt (el extremo más exigente del rango de 7-8pt pedido) en un máximo de 2
-- líneas. No es un número inventado.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.genres
  add column color_hex text,
  add column icon_url text;

alter table public.traits
  add column color_hex text,
  add column icon_url text;

alter table public.game_settings
  add column card_template jsonb;

-- Valores por defecto para que la plantilla ya funcione (aunque en blanco,
-- sin marco todavía) antes de que un admin toque los sliders de
-- /admin/ajustes. Todos los valores espaciales son porcentaje relativo al
-- tamaño de la carta, nunca píxeles fijos.
update public.game_settings
set card_template = '{
  "marco_url": null,
  "zona_nombre": {"x": 10, "y": 4, "ancho": 80, "alto": 14, "angulo": 0, "interlineado": 110},
  "margen_iconos": 4,
  "tamaño_icono_genero": 12,
  "tamaño_icono_rasgo": 12,
  "tamaño_poder_score": 9,
  "poder": {"offset_x": 0, "offset_y": 0},
  "score": {"offset_x": 0, "offset_y": 0}
}'::jsonb
where id = true;

alter table public.cards
  add column use_card_name_as_display boolean not null default true,
  add column display_line_1 text,
  add column display_line_2 text,
  add column display_line_3 text,
  add column chapter_info text
    constraint cards_chapter_info_length check (char_length(chapter_info) <= 90);

comment on column public.genres.color_hex is 'Color de marca del Género (#rrggbb), usado para recolorear su propio ícono en la carta.';
comment on column public.genres.icon_url is 'Ícono del Género (PNG con transparencia recomendado), recoloreado en el cliente vía mask-image.';
comment on column public.traits.color_hex is 'Color de marca del Rasgo (#rrggbb) -- se usa para el ícono de Rasgo Y TAMBIÉN para Poder y Score en la carta, nunca el color del Género.';
comment on column public.traits.icon_url is 'Ícono del Rasgo (PNG con transparencia recomendado), recoloreado en el cliente vía mask-image.';
comment on column public.game_settings.card_template is 'Plantilla general de composición del arte de carta: marco, zona de nombre, tamaños e íconos, todo en porcentaje relativo al tamaño de la carta.';
comment on column public.cards.use_card_name_as_display is 'Si es true (default), el arte de la carta muestra el nombre de la carta. Si es false, muestra display_line_1/2/3 en su lugar.';
comment on column public.cards.chapter_info is 'Texto corto para el crédito impreso ("{chapter_info}. Arte por {artist}."). Límite de 90 caracteres calculado para 2 líneas a 7-8pt en 57mm de ancho.';
