"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { roleLabels } from "@/lib/constants";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="h-14 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        {session?.user && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 bg-blue-900/30 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium leading-none">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[session.user.role] || session.user.role}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
