export type TradeDefault = "publicas" | "privadas";

export type Profile = {
  id: string;
  display_name: string | null;
  player_code: string;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  trade_default: TradeDefault;
  has_seen_welcome: boolean;
  banned_until: string | null;
};

export type Rarity = "comun" | "rara" | "epica" | "legendaria";

export const RARITIES: Rarity[] = ["comun", "rara", "epica", "legendaria"];

export const RARITY_LABELS: Record<Rarity, string> = {
  comun: "Común",
  rara: "Rara",
  epica: "Épica",
  legendaria: "Legendaria",
};

export type CardSet = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  released_at: string | null;
  is_active: boolean;
};

export type Genre = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  base_ability_name: string;
  base_ability_text: string;
  fandom_ability_name: string;
  fandom_ability_text: string;
  color_hex: string | null;
  icon_url: string | null;
};

export type Trait = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  ability_name: string;
  ability_text: string;
  color_hex: string | null;
  icon_url: string | null;
};

// Plantilla general de composición del arte de carta (game_settings.card_template).
// Todo valor espacial es porcentaje relativo al tamaño de la carta, nunca
// píxeles fijos, para que escale igual en pantalla e impresión. Tamaño va
// compartido de a pares (un tamaño para los dos íconos, otro para
// Poder/Puntaje); cada uno de los 4 elementos tiene su propio offset
// independiente, medido desde su esquina de anclaje (género: arriba-izq,
// rasgo: abajo-der, poder: arriba-der, score: abajo-izq).
export type CardTemplateOffset = { offset_x: number; offset_y: number };

export type CardTemplate = {
  marco_url: string | null;
  // El tamaño y el interlineado del nombre viven por carta (cards.name_font_size
  // / cards.name_line_height), no acá: nombres de largo distinto necesitan
  // ajustes distintos. Esta zona solo define dónde y con qué rotación va.
  zona_nombre: {
    x: number;
    y: number;
    ancho: number;
    alto: number;
    angulo: number;
  };
  "tamaño_iconos": number;
  "tamaño_poder_score": number;
  // Estiramiento vertical de Poder/Puntaje, en % (100 = normal), sin tocar
  // el ancho -- solo la altura de esos dos números, nunca del nombre.
  "altura_poder_score": number;
  icono_genero: CardTemplateOffset;
  icono_rasgo: CardTemplateOffset;
  poder: CardTemplateOffset;
  score: CardTemplateOffset;
  // Línea de crédito de impresión/postal: siempre centrada en X, solo
  // necesita desplazamiento vertical y tamaño.
  credito: { offset_y: number; "tamaño": number };
};

export type GameSettings = {
  id: true;
  card_back_screen_url: string | null;
  card_back_print_url: string | null;
  postal_back_print_url: string | null;
  pack_image_url: string | null;
  card_template: CardTemplate | null;
  card_name_font_url: string | null;
};

export type Card = {
  id: string;
  set_id: string;
  slug: string;
  name: string;
  description: string | null;
  rarity: Rarity;
  image_front_url: string | null;
  print_front_url: string | null;
  artist: string | null;
  is_active: boolean;
  released_at: string | null;
  sort_order: number;
  genre_id: string | null;
  trait_id: string | null;
  power: number | null;
  score: number | null;
  is_fandom: boolean;
  use_card_name_as_display: boolean;
  display_line_1: string | null;
  display_line_2: string | null;
  display_line_3: string | null;
  chapter_info: string | null;
  apply_art_template: boolean;
  name_shadow_intensity: number;
  name_font_size: number;
  name_line_height: number;
};

// Límite de chapter_info: calculado (no inventado) midiendo con Titillium Web
// real cuánto texto entra en 57mm de ancho (63mm de carta - 3mm de margen de
// seguridad a cada lado, el mismo ART_W_MM de components/imprimir/print-block.tsx)
// a 8pt (el extremo más exigente del rango de 7-8pt) en 2 líneas.
export const CHAPTER_INFO_MAX_LENGTH = 90;

// Una carta activa del juego combinada con cuántas copias tiene el jugador
// (0 si no la tiene). Usado en /coleccion.
export type CollectionCard = Card & { quantity: number };

export type PackType = {
  id: string;
  name: string;
  cards_count: number;
  rarity_weights: Record<Rarity, number>;
  allowed_set_ids: string[];
  guaranteed_rarity: Rarity | null;
  image_url: string | null;
};

export type RedeemedCard = {
  card_id: string;
  slug: string;
  name: string;
  rarity: Rarity;
  image_front_url: string | null;
  is_new: boolean;
  // Cantidad total (no solo la de este sobre) que el jugador tiene de esta
  // carta después del canje -- la necesita el interruptor "Disponible
  // para intercambio" para calcular a qué valor de public_quantity
  // corresponde "todo público" (quantity - 1).
  quantity: number;
  // Lo que necesita la plantilla de arte para que la carta se vea igual acá
  // que en la colección, apenas se revela.
  genre_id: string | null;
  trait_id: string | null;
  power: number | null;
  score: number | null;
  use_card_name_as_display: boolean;
  display_line_1: string | null;
  display_line_2: string | null;
  display_line_3: string | null;
  apply_art_template: boolean;
  name_shadow_intensity: number;
  name_font_size: number;
  name_line_height: number;
};

export type RedeemResult = {
  redemption_id: string;
  pack_type_name: string;
  pack_image_url: string | null;
  // Preferencia del jugador al momento del canje: determina si las cartas
  // repetidas de este sobre ya quedaron públicas o privadas por defecto.
  trade_default: TradeDefault;
  cards: RedeemedCard[];
};

export type CodeBatchStats = {
  batch_label: string;
  pack_type_id: string;
  pack_type_name: string;
  total_codes: number;
  total_max_uses: number;
  total_uses_count: number;
  fully_redeemed_codes: number;
  active_codes: number;
  expires_at: string | null;
  created_at: string;
};

export type TradeStatus = "pendiente" | "aceptado" | "rechazado" | "cancelado" | "expirado";

export type Trade = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: TradeStatus;
  message: string | null;
  created_at: string;
  resolved_at: string | null;
  expires_at: string | null;
};

export type TradeItem = {
  id: string;
  trade_id: string;
  user_id: string;
  card_id: string;
  quantity: number;
};

// Campos públicos de un profile ajeno, resueltos vía get_public_profiles()/
// find_profile_by_code() (RPC security definer) -- nunca incluye is_admin.
export type PublicProfile = {
  id: string;
  display_name: string | null;
  player_code: string;
  avatar_url: string | null;
};

export type Contact = {
  id: string;
  user_id: string;
  contact_user_id: string;
  nickname: string | null;
  created_at: string;
};

export type Deck = {
  id: string;
  user_id: string;
  name: string;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type DeckCard = {
  deck_id: string;
  card_id: string;
  quantity: number;
};

export type FeedbackType = "falla" | "sugerencia" | "otro";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  falla: "Falla",
  sugerencia: "Sugerencia",
  otro: "Otro",
};

export type Feedback = {
  id: string;
  user_id: string | null;
  type: FeedbackType;
  page_path: string;
  message: string;
  created_at: string;
};

export type BlockedUser = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};
