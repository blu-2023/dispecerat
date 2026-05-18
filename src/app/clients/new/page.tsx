import ClientForm from "../client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Client nou</h1>
      <ClientForm />
    </div>
  );
}
