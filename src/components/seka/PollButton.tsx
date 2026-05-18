"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function PollButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePoll() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/seka/poll", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Eroare la polling");
      }
      const data = await res.json();
      setMessage(data.message || "Polling efectuat cu succes");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Eroare la polling";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handlePoll}
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Se interoghează..." : "Polling manual"}
      </Button>
      {message && (
        <span className="text-sm text-slate-400">{message}</span>
      )}
    </div>
  );
}
