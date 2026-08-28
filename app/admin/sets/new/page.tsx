import { SetForm } from "../set-form";

export default function NewSetPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Nueva expansión</h1>
      <SetForm />
    </div>
  );
}
