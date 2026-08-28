export type TradeDefault = "publicas" | "privadas";

export type Profile = {
  id: string;
  display_name: string | null;
  player_code: string;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  trade_default: TradeDefault;
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
};

export type Trait = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  ability_name: string;
  ability_text: string;
};

export type GameSettings = {
  id: true;
  card_back_screen_url: string | null;
  card_back_print_url: string | null;
  pack_image_url: string | null;
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
};

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
