"use client";

import { LoginPanel } from "@/components/auth/login-panel";
import { SplashLayer } from "@/components/splash/splash-layer";
import { ScaledFrame } from "./scaled-frame";

export type PreviewValues = {
  imageUrl: string | null;
  focusX: number;
  focusY: number;
  overlayOpacity: number;
  title: string;
  body: string;
  textColor: string;
};

function Screen({ values }: { values: PreviewValues }) {
  return (
    <>
      <SplashLayer
        imageUrl={values.imageUrl}
        focusX={values.focusX}
        focusY={values.focusY}
        overlayOpacity={values.overlayOpacity}
      />
      <div className="relative z-10 flex h-full w-full items-center justify-center px-6 py-12">
        <LoginPanel
          title={values.title.trim() || undefined}
          subtitle={values.body.trim() || undefined}
          textColor={values.textColor}
          next="/"
          preview
        />
      </div>
    </>
  );
}

// Dos marcos, escritorio y celular, con los botones de login encima como se
// ven de verdad (aquí no responden al clic).
export function SplashPreview({ values }: { values: PreviewValues }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-marca-noche/60">Escritorio</span>
        <ScaledFrame virtualWidth={1280} virtualHeight={720} label="Vista previa en escritorio" className="w-full">
          <Screen values={values} />
        </ScaledFrame>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-marca-noche/60">Celular</span>
        <ScaledFrame virtualWidth={390} virtualHeight={844} label="Vista previa en celular" className="w-[220px]">
          <Screen values={values} />
        </ScaledFrame>
      </div>
    </div>
  );
}
