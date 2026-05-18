"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface EmailSendDialogProps {
  incidentId: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
}

export default function EmailSendDialog({
  incidentId,
  defaultTo,
  defaultSubject,
  defaultBody,
}: EmailSendDialogProps) {
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          toEmail,
          subject,
          body,
        }),
      });

      if (res.ok) {
        setResult({ success: true, message: "Email trimis cu succes!" });
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 1500);
      } else {
        const err = await res.json();
        setResult({
          success: false,
          message: err.error || "Eroare la trimiterea emailului",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Eroare la trimiterea emailului",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        Trimite email
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trimite notificare email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="toEmail">Destinatar</Label>
            <Input
              id="toEmail"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subiect</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Conținut</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded text-sm ${
                result.success
                  ? "bg-green-900/30 text-green-400"
                  : "bg-red-900/30 text-red-400"
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={sending}
            >
              Anulează
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Se trimite..." : "Trimite"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
