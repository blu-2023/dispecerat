"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Camera,
  AlertTriangle,
  Mail,
  UserCog,
  ScrollText,
  Shield,
  Radio,
  Settings,
  MonitorPlay,
  Video,
  Download,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pereți video", href: "/walls", icon: MonitorPlay },
  { name: "Camere", href: "/cameras", icon: Video },
  { name: "NVR-uri & obiective", href: "/video-sites", icon: Camera },
  { name: "Sesizare nouă", href: "/incidents/new", icon: AlertTriangle },
  { name: "Sesizări", href: "/incidents", icon: ScrollText },
  { name: "Clienți", href: "/clients", icon: Users },
  { name: "Obiective", href: "/sites", icon: Building2 },
  { name: "Template-uri", href: "/templates", icon: Mail },
  { name: "Utilizatori", href: "/users", icon: UserCog },
  { name: "Audit", href: "/audit", icon: Shield },
  { name: "SEKA", href: "/seka", icon: Radio },
  { name: "Aplicație desktop", href: "/downloads", icon: Download },
  { name: "Setări", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const orgName = session?.user?.organizationName || "Organizație";
  const orgPlan = session?.user?.organizationPlan || "FREE";

  const planColors: Record<string, string> = {
    FREE: "bg-slate-700 text-slate-300",
    PRO: "bg-blue-900/50 text-blue-400",
    ENTERPRISE: "bg-purple-900/50 text-purple-400",
  };

  return (
    <div className="flex flex-col w-64 bg-slate-900 text-white min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">
              {orgName.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm truncate">{orgName}</h1>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", planColors[orgPlan] || planColors.FREE)}>
              {orgPlan}
            </span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/incidents/new" &&
              pathname.startsWith(item.href) &&
              !navigation.some(
                (other) =>
                  other.href !== item.href &&
                  other.href.startsWith(item.href) &&
                  pathname.startsWith(other.href)
              ));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-700">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
            pathname === "/settings"
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          Setări
        </Link>
      </div>
    </div>
  );
}
