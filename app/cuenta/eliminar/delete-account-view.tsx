"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteAccount } from "./actions";

export function DeleteAccountView() {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmText.trim().toLowerCase() === "borrar";

  const handleDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await deleteAccount(confirmText);
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-marca-rojo/30 bg-white p-6">
      <h1 className="text-2xl text-marca-rojo">Eliminar cuenta</h1>

      <p className="text-sm text-marca-noche/70">
        Esta acción es permanente y no se puede deshacer. Al eliminar tu cuenta vas a perder:
      </p>

      <ul className="list-disc pl-5 text-sm text-marca-noche/70">
        <li>Toda tu colección de cartas</li>
        <li>Tus mazos guardados</li>
        <li>Tu historial de intercambios y las ofertas pendientes</li>
        <li>Tus amigos guardados</li>
        <li>Todo lo demás asociado a tu cuenta</li>
      </ul>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm-delete" className="text-sm font-semibold text-marca-noche">
          Escribe <span className="text-marca-rojo">Borrar</span> para confirmar
        </label>
        <input
          id="confirm-delete"
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="Borrar"
          autoComplete="off"
          className="rounded-lg border border-marca-noche/20 px-4 py-3 text-sm focus:border-marca-rojo focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/coleccion"
          className="flex-1 touch-manipulation rounded-xl border border-marca-noche/20 px-4 py-3 text-center text-sm font-semibold text-marca-noche"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!isConfirmed || pending}
          className="flex-1 touch-manipulation rounded-xl bg-marca-rojo px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Eliminando…" : "Eliminar cuenta para siempre"}
        </button>
      </div>
    </div>
  );
}
