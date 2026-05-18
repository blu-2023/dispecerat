"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, MonitorDown, ExternalLink } from "lucide-react";

type Asset = { name: string; size: number; url: string; contentType: string; downloadCount: number };
type ReleaseInfo = {
  configured: boolean; repo?: string; tag?: string; name?: string;
  publishedAt?: string; htmlUrl?: string; notes?: string;
  assets: Asset[]; error?: string;
};

function bytesToMB(n: number) { return (n / 1024 / 1024).toFixed(1) + " MB"; }

function detectOS(): "win" | "mac" | "linux" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "win";
  if (ua.includes("mac")) return "mac";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";
  return "unknown";
}

function osFromAsset(a: Asset): "win" | "mac" | "linux" | "unknown" {
  const n = a.name.toLowerCase();
  if (/\.(exe|msi|appx)$/.test(n) || n.includes("setup")) return "win";
  if (/\.(dmg|pkg)$/.test(n) || n.includes("mac") || n.includes("darwin")) return "mac";
  if (/\.(appimage|deb|rpm|snap|tar\.gz)$/.test(n) || n.includes("linux")) return "linux";
  return "unknown";
}

const OS_LABEL: Record<string, string> = {
  win: "Windows", mac: "macOS", linux: "Linux", unknown: "Alt",
};

export default function DownloadsClient() {
  const [data, setData] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [osNow, setOsNow] = useState<"win" | "mac" | "linux" | "unknown">("unknown");

  useEffect(() => {
    setOsNow(detectOS());
    fetch("/api/downloads")
      .then(r => r.json())
      .then((d: ReleaseInfo) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const recommended = useMemo(() => {
    if (!data?.assets?.length) return null;
    return data.assets.find(a => osFromAsset(a) === osNow) || null;
  }, [data, osNow]);

  if (loading) return <div className="p-6 text-muted-foreground">Se încarcă…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MonitorDown className="w-6 h-6" /> Aplicație desktop
        </h1>
        <p className="text-sm text-muted-foreground">
          Instalează aplicația desktop pe stația de dispecerat — consolă + pereți video pe mai multe monitoare,
          alerte sonore/vizuale, integrare YOLO.
        </p>
      </div>

      {!data?.configured && (
        <Card>
          <CardContent className="p-6 space-y-2">
            <div className="font-semibold">Configurarea descărcării nu este finalizată</div>
            <p className="text-sm text-muted-foreground">
              Setează <code className="bg-neutral-900 px-1.5 py-0.5 rounded">GITHUB_REPO=&quot;owner/repo&quot;</code> în
              fișierul <code className="bg-neutral-900 px-1.5 py-0.5 rounded">.env</code> și repornește aplicația web.
              Apoi lansează workflow-ul <i>Build Desktop (Windows)</i> din tab-ul Actions al repo-ului GitHub
              (sau publică un tag <code>v0.1.0</code>) ca să apară un instalator pentru descărcare.
            </p>
          </CardContent>
        </Card>
      )}

      {data?.configured && data.error && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="font-semibold text-orange-300">{data.error}</div>
            <p className="text-sm text-muted-foreground">
              Repo configurat: <code className="bg-neutral-900 px-1.5 py-0.5 rounded">{data.repo}</code>
            </p>
            {data.repo && (
              <a href={`https://github.com/${data.repo}/actions/workflows/build-desktop.yml`} target="_blank" rel="noopener">
                <Button variant="outline" size="sm">
                  Deschide Actions <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Button>
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {data?.assets && data.assets.length > 0 && (
        <>
          {recommended && (
            <Card className="border-blue-700 bg-blue-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recomandat pentru sistemul tău: {OS_LABEL[osNow]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-sm">{recommended.name}</div>
                    <div className="text-xs text-muted-foreground">{bytesToMB(recommended.size)}</div>
                  </div>
                  <a href={recommended.url} target="_blank" rel="noopener">
                    <Button>
                      <Download className="w-4 h-4 mr-2" /> Descarcă
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  După descărcare, dă dublu-click pe instalator. Aplicația se conectează automat la
                  acest server (192.168.1.100:3000). Dacă apare avertizare SmartScreen, alege „Run anyway".
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Toate instalatoarele · {data.tag}</span>
                {data.htmlUrl && (
                  <a href={data.htmlUrl} target="_blank" rel="noopener" className="text-sm text-blue-400 hover:underline">
                    GitHub Release ↗
                  </a>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.assets.map(a => {
                const os = osFromAsset(a);
                return (
                  <div key={a.name} className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-neutral-800 bg-neutral-900/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{OS_LABEL[os]}</Badge>
                        <span className="font-mono text-sm truncate">{a.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {bytesToMB(a.size)} · {a.downloadCount} descărcări
                      </div>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener">
                      <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1.5" />Descarcă</Button>
                    </a>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {data.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notițe versiune</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{data.notes}</pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Instrucțiuni pentru dispecer</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <div>1. Descarcă instalatorul potrivit sistemului de operare.</div>
          <div>2. Rulează instalatorul (acceptă SmartScreen dacă apare — semnătura este nesemnată momentan).</div>
          <div>3. La prima pornire, aplicația încarcă consola web și solicită login.</div>
          <div>4. Din meniul „Pereți video" deschide wall-urile pe monitoarele dorite.</div>
          <div>5. Sunet/imagine — testează cu o cameră în Setări → Pereți video → un wall de test.</div>
        </CardContent>
      </Card>
    </div>
  );
}
