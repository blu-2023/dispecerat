import { Suspense } from "react";
import NewIncidentForm from "@/components/incidents/NewIncidentForm";

export default function NewIncidentPage() {
  return (
    <Suspense fallback={<div className="p-6">Se încarcă formularul...</div>}>
      <NewIncidentForm />
    </Suspense>
  );
}
