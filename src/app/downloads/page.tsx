import DownloadsClient from "./client";
import { getSessionOrThrow } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DownloadsPage() {
  await getSessionOrThrow();
  return <DownloadsClient />;
}
