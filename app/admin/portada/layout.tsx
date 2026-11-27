import { PortadaTabs } from "./portada-tabs";

export default function PortadaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">Portada</h1>
      <PortadaTabs />
      {children}
    </div>
  );
}
