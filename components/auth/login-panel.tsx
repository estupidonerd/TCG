import type { ReactNode } from "react";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { TwitchLoginButton } from "@/components/auth/twitch-login-button";

export const LOGIN_DEFAULT_TITLE = "Estúpido Nerd TCG";
export const LOGIN_DEFAULT_SUBTITLE = "Inicia sesión para armar tu colección";

// El contenido de la pantalla de entrada: título, texto y botones de login. Lo
// usan la pantalla real (/login) y la vista previa del admin, así lo que se ve
// al editar una portada es lo mismo que verán los jugadores.
//
// Sin `textColor` queda EXACTAMENTE como siempre (colores de la marca). Con
// `textColor` (hay una portada activa) el título y el texto llevan ese color y
// una sombra suave, y los botones van sobre un respaldo semitransparente para
// que se lean sobre cualquier imagen.
export function LoginPanel({
  title = LOGIN_DEFAULT_TITLE,
  subtitle = LOGIN_DEFAULT_SUBTITLE,
  textColor = null,
  next,
  error = false,
  notice,
  preview = false,
}: {
  title?: string;
  subtitle?: string;
  textColor?: string | null;
  next: string;
  error?: boolean;
  // El cartel de aviso (modo Aviso), si hay uno.
  notice?: ReactNode;
  // En la vista previa del admin los botones se dibujan pero no responden.
  preview?: boolean;
}) {
  const colorStyle = textColor ? { color: textColor } : undefined;
  const shadow = textColor ? "[text-shadow:0_1px_14px_rgb(0_0_33/0.55)]" : "";

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
      {notice}

      <div className="flex flex-col gap-2">
        <h1 className={`text-3xl ${shadow}`} style={colorStyle}>
          {title}
        </h1>
        <p
          className={`whitespace-pre-line text-sm font-light ${textColor ? shadow : "text-marca-noche/70"}`}
          style={colorStyle}
        >
          {subtitle}
        </p>
      </div>

      {error && (
        <p className="w-full rounded border border-marca-rojo/40 bg-marca-rojo/10 px-4 py-2 text-sm text-marca-rojo">
          No pudimos completar el login. Intenta de nuevo.
        </p>
      )}

      <div
        className={`flex w-full flex-col gap-3 ${
          textColor ? "rounded-2xl bg-marca-noche/55 p-4 backdrop-blur-sm" : ""
        }`}
        inert={preview}
      >
        <GoogleLoginButton next={next} />
        <DiscordLoginButton next={next} />
        <TwitchLoginButton next={next} />
      </div>
    </div>
  );
}
