import { randomInt } from "node:crypto";

// Sin caracteres ambiguos: nada de O, 0, I, 1, L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP_SIZE = 4;
const GROUP_COUNT = 3; // 3 grupos de 4 = 12 caracteres, ej: ABCD-EFGH-JKMN

function randomCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = "";
    for (let i = 0; i < GROUP_SIZE; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

// Genera `count` códigos únicos entre sí (dentro del lote). La probabilidad
// de colisión contra códigos ya existentes en la tabla es astronómicamente
// baja (31^12 combinaciones posibles) y se maneja como error de la
// constraint unique al insertar, no acá.
export function generateUniqueCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(randomCode());
  }
  return Array.from(codes);
}
