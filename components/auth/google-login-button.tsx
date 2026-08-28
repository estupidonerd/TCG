"use client";

import { useState } from "react";
import { Roboto } from "next/font/google";
import { createClient } from "@/lib/supabase/client";

// Google pide Roboto para el botón oficial de "Sign in with Google". Se
// carga acá (no en el layout global) porque es lo único que la usa.
const roboto = Roboto({ subsets: ["latin"], weight: ["500"] });

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8064.54-1.8368.8586-3.0477.8586-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
      />
    </svg>
  );
}

export function GoogleLoginButton({ next = "/" }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    // Si signInWithOAuth falla antes de redirigir (ej. provider mal
    // configurado en Supabase), se reactiva el botón para reintentar.
    if (error) {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`${roboto.className} flex h-11 w-full items-center justify-center gap-3 rounded border border-[#747775] bg-white px-4 text-sm font-medium tracking-[0.25px] text-[#1f1f1f] normal-case transition-colors hover:bg-[#f8f8f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-60 active:bg-[#f0f0f0]`}
    >
      <GoogleLogo />
      <span>{loading ? "Conectando…" : "Continuar con Google"}</span>
    </button>
  );
}
