import { NextResponse } from "next/server";
import { getSessionOrThrow } from "@/lib/session";

// Returns the latest GitHub Release with its downloadable assets.
// Cached for 5 minutes so we don't hammer the GitHub API rate limit.
//
// Env vars:
//   GITHUB_REPO            owner/repo (required, e.g. "interguard/dispecerat")
//   GITHUB_RELEASES_TOKEN  optional read-only token for private repos
type Asset = {
  name: string;
  size: number;
  url: string;
  contentType: string;
  downloadCount: number;
};
type ReleaseInfo = {
  configured: boolean;
  repo?: string;
  tag?: string;
  name?: string;
  publishedAt?: string;
  htmlUrl?: string;
  notes?: string;
  assets: Asset[];
  error?: string;
};

let cache: { at: number; data: ReleaseInfo } | null = null;
const TTL = 5 * 60 * 1000;

export async function GET() {
  try {
    await getSessionOrThrow();
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const repo = process.env.GITHUB_REPO || "";
  if (!repo) {
    return NextResponse.json<ReleaseInfo>({
      configured: false,
      assets: [],
    });
  }

  if (cache && Date.now() - cache.at < TTL && cache.data.repo === repo) {
    return NextResponse.json(cache.data);
  }

  const token = process.env.GITHUB_RELEASES_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "dispecerat-app",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers, cache: "no-store" });
    if (r.status === 404) {
      const data: ReleaseInfo = { configured: true, repo, assets: [], error: "Nicio versiune publicată încă. Rulează workflow-ul GitHub Actions sau publică un tag v*." };
      cache = { at: Date.now(), data };
      return NextResponse.json(data);
    }
    if (!r.ok) {
      const data: ReleaseInfo = { configured: true, repo, assets: [], error: `GitHub API: ${r.status} ${r.statusText}` };
      return NextResponse.json(data);
    }
    const j = await r.json();
    const data: ReleaseInfo = {
      configured: true,
      repo,
      tag: j.tag_name,
      name: j.name || j.tag_name,
      publishedAt: j.published_at,
      htmlUrl: j.html_url,
      notes: j.body || "",
      assets: (j.assets || []).map((a: { name: string; size: number; browser_download_url: string; content_type: string; download_count: number }) => ({
        name: a.name,
        size: a.size,
        url: a.browser_download_url,
        contentType: a.content_type,
        downloadCount: a.download_count,
      })),
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json<ReleaseInfo>({
      configured: true,
      repo,
      assets: [],
      error: e instanceof Error ? e.message : "Eroare necunoscută",
    }, { status: 502 });
  }
}
