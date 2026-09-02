import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./settings-form";
import { GenresForm } from "./genres-form";
import { TraitsForm } from "./traits-form";
import { CardTemplateForm, type TemplateSampleCard } from "./card-template-form";
import type { CardTemplate, GameSettings, Genre, Trait } from "@/lib/supabase/types";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

// Fusiona lo guardado con los defaults campo por campo (incluidos los
// objetos anidados) en vez de todo-o-nada: si se agrega un campo nuevo a la
// plantilla (como pasó con altura_poder_score), una fila vieja guardada
// antes de ese cambio no se queda con ese campo en undefined -- eso hacía
// que el slider correspondiente pasara de no controlado a controlado en el
// primer render y React se quejara.
function mergeCardTemplate(
  stored: Partial<CardTemplate> | null | undefined,
  defaults: CardTemplate,
): CardTemplate {
  if (!stored) return defaults;
  return {
    ...defaults,
    ...stored,
    zona_nombre: { ...defaults.zona_nombre, ...stored.zona_nombre },
    icono_genero: { ...defaults.icono_genero, ...stored.icono_genero },
    icono_rasgo: { ...defaults.icono_rasgo, ...stored.icono_rasgo },
    poder: { ...defaults.poder, ...stored.poder },
    score: { ...defaults.score, ...stored.score },
    credito: { ...defaults.credito, ...stored.credito },
  };
}

const DEFAULT_CARD_TEMPLATE: CardTemplate = {
  marco_url: null,
  zona_nombre: { x: 10, y: 4, ancho: 80, alto: 14, angulo: 0 },
  "tamaño_iconos": 12,
  "tamaño_poder": 9,
  "tamaño_score": 9,
  "altura_poder_score": 100,
  icono_genero: { offset_x: 4, offset_y: 4 },
  icono_rasgo: { offset_x: 4, offset_y: 4 },
  poder: { offset_x: 4, offset_y: 4 },
  score: { offset_x: 4, offset_y: 4 },
  credito: { offset_y: 2, "tamaño": 4 },
};

export default async function AdminAjustesPage() {
  // Esta página usa el cliente service_role para generar la signed URL del
  // dorso de impresión (bucket privado). Se repite el guard acá -no solo
  // confiar en el layout- por la misma razón que en /admin/codes/stats:
  // Next puede renderizar esta página en paralelo con el layout.
  await requireAdminOrRedirect();

  const supabase = await createClient();
  const [{ data: settings }, { data: genres }, { data: traits }, { data: sampleCardsData }] =
    await Promise.all([
      supabase
        .from("game_settings")
        .select(
          "id, card_back_screen_url, card_back_print_url, postal_back_print_url, pack_image_url, card_template, card_name_font_url",
        )
        .eq("id", true)
        .single(),
      supabase
        .from("genres")
        .select(
          "id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text, color_hex, icon_url",
        )
        .order("sort_order"),
      supabase
        .from("traits")
        .select("id, slug, name, sort_order, ability_name, ability_text, color_hex, icon_url")
        .order("sort_order"),
      supabase
        .from("cards")
        .select(
          "id, name, image_front_url, power, score, use_card_name_as_display, display_line_1, display_line_2, display_line_3, chapter_info, artist, genre_id, trait_id, apply_art_template, name_shadow_intensity, name_font_size, name_line_height",
        )
        .eq("is_active", true)
        .not("image_front_url", "is", null)
        .order("sort_order")
        .limit(20),
    ]);

  const typedSettings = settings as GameSettings | null;
  const typedGenres = (genres ?? []) as Genre[];
  const typedTraits = (traits ?? []) as Trait[];
  const genresById = new Map(typedGenres.map((genre) => [genre.id, genre]));
  const traitsById = new Map(typedTraits.map((trait) => [trait.id, trait]));

  const sampleCards: TemplateSampleCard[] = (sampleCardsData ?? []).map((card) => ({
    id: card.id as string,
    name: card.name as string,
    image_front_url: card.image_front_url as string | null,
    power: card.power as number | null,
    score: card.score as number | null,
    use_card_name_as_display: card.use_card_name_as_display as boolean,
    display_line_1: card.display_line_1 as string | null,
    display_line_2: card.display_line_2 as string | null,
    display_line_3: card.display_line_3 as string | null,
    chapter_info: card.chapter_info as string | null,
    artist: card.artist as string | null,
    genre: card.genre_id ? (genresById.get(card.genre_id as string) ?? null) : null,
    trait: card.trait_id ? (traitsById.get(card.trait_id as string) ?? null) : null,
    apply_art_template: card.apply_art_template as boolean,
    name_shadow_intensity: card.name_shadow_intensity as number,
    name_font_size: card.name_font_size as number,
    name_line_height: card.name_line_height as number,
  }));

  const admin = createAdminClient();
  const [printSigned, postalBackSigned] = await Promise.all([
    typedSettings?.card_back_print_url
      ? admin.storage
          .from("card-print")
          .createSignedUrl(typedSettings.card_back_print_url, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
    typedSettings?.postal_back_print_url
      ? admin.storage
          .from("card-print")
          .createSignedUrl(typedSettings.postal_back_print_url, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl">Ajustes del juego</h1>
        <SettingsForm
          initialScreenUrl={typedSettings?.card_back_screen_url ?? null}
          initialPrintPreviewUrl={printSigned?.data?.signedUrl ?? null}
          initialPostalBackPreviewUrl={postalBackSigned?.data?.signedUrl ?? null}
          initialPackImageUrl={typedSettings?.pack_image_url ?? null}
        />
      </div>

      <GenresForm genres={typedGenres} />
      <TraitsForm traits={typedTraits} />
      <CardTemplateForm
        initialTemplate={mergeCardTemplate(typedSettings?.card_template, DEFAULT_CARD_TEMPLATE)}
        initialFontUrl={typedSettings?.card_name_font_url ?? null}
        sampleCards={sampleCards}
      />
    </div>
  );
}
