import { redirect } from "next/navigation";

// Backward compat — old route, kept as redirect.
export default function VpnSitesPage() {
  redirect("/video-sites");
}
