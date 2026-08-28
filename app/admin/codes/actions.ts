"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateUniqueCodes } from "@/lib/admin/generate-codes";
import type { CodeBatchStats } from "@/lib/supabase/types";

const MAX_QUANTITY = 2000;

export type GenerateCodesResult = {
  batchLabel: string;
  packTypeName: string;
  maxUses: number;
  onePerUser: boolean;
  expiresAt: string | null;
  codes: string[];
};

// No redirige (a diferencia de las otras acciones de /admin): el resultado
// -incluidos los códigos generados en texto plano- se devuelve al cliente
// para armar el CSV. Es la única vez que los códigos viajan al navegador:
// después de esto, la tabla `codes` sigue sin ser legible por nadie salvo
// service_role.
export async function generateCodeBatch(
  formData: FormData,
): Promise<GenerateCodesResult> {
  await requireAdmin();

  const packTypeId = String(formData.get("pack_type_id") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const maxUses = Number(formData.get("max_uses") ?? 1);
  const onePerUser = formData.get("one_per_user") === "on";
  const batchLabelInput = String(formData.get("batch_label") ?? "").trim();
  const expiresAt = String(formData.get("expires_at") ?? "").trim();

  if (!packTypeId) throw new Error("Elegí un tipo de sobre.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`La cantidad tiene que ser un entero entre 1 y ${MAX_QUANTITY}.`);
  }
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    throw new Error("Los usos máximos tienen que ser un entero mayor o igual a 1.");
  }

  const admin = createAdminClient();

  const { data: packType, error: packError } = await admin
    .from("pack_types")
    .select("id, name")
    .eq("id", packTypeId)
    .single();
  if (packError || !packType) throw new Error("El tipo de sobre elegido no existe.");

  const batchLabel =
    batchLabelInput || `${packType.name} ${new Date().toISOString().slice(0, 10)}`;
  const codes = generateUniqueCodes(quantity);

  const rows = codes.map((code) => ({
    code,
    pack_type_id: packTypeId,
    max_uses: maxUses,
    uses_count: 0,
    one_per_user: onePerUser,
    batch_label: batchLabel,
    expires_at: expiresAt || null,
    is_active: true,
  }));

  const { error } = await admin.from("codes").insert(rows);
  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Colisión al azar generando un código (extremadamente improbable): reintentá generar el lote."
        : error.message,
    );
  }

  return {
    batchLabel,
    packTypeName: packType.name,
    maxUses,
    onePerUser,
    expiresAt: expiresAt || null,
    codes,
  };
}

export type CodeDetail = {
  code: string;
  uses_count: number;
  max_uses: number;
};

export async function getBatchCodes(batchLabel: string): Promise<CodeDetail[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("codes")
    .select("code, uses_count, max_uses")
    .eq("batch_label", batchLabel)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

type CodeStatsRow = {
  batch_label: string | null;
  pack_type_id: string;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  created_at: string;
  pack_types: { name: string } | null;
};

export async function getCodeBatchStats(): Promise<CodeBatchStats[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("codes")
    .select(
      "batch_label, pack_type_id, max_uses, uses_count, expires_at, created_at, pack_types(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as CodeStatsRow[];
  const groups = new Map<string, CodeBatchStats>();

  for (const row of rows) {
    const key = row.batch_label ?? "(sin etiqueta)";
    const existing = groups.get(key);

    if (existing) {
      existing.total_codes += 1;
      existing.total_max_uses += row.max_uses;
      existing.total_uses_count += row.uses_count;
      if (row.uses_count >= row.max_uses) existing.fully_redeemed_codes += 1;
    } else {
      groups.set(key, {
        batch_label: key,
        pack_type_id: row.pack_type_id,
        pack_type_name: row.pack_types?.name ?? "—",
        total_codes: 1,
        total_max_uses: row.max_uses,
        total_uses_count: row.uses_count,
        fully_redeemed_codes: row.uses_count >= row.max_uses ? 1 : 0,
        expires_at: row.expires_at,
        created_at: row.created_at,
      });
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
