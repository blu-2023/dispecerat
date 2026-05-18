"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AlertCenter from "@/components/alerts/AlertCenter";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isLoginPage = pathname === "/login";
  const isFullscreenWall = /^\/walls\/[^/]+$/.test(pathname) && !pathname.endsWith("/edit");

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Fullscreen wall view: render children only (no chrome).
  // The AlertCenter is still mounted because the wall has its own per-tile
  // alert; global toast is suppressed inside AlertCenter on /walls/* routes.
  if (isFullscreenWall) {
    return <>{children}{session?.user && <AlertCenter />}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="w-px bg-black min-h-screen" />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-slate-900">{children}</main>
      </div>
      {session?.user && <AlertCenter />}
    </div>
  );
}
