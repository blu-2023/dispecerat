/**
 * Electron shell for Dispecerat.
 *
 * Windows:
 *   - Console: loads the Next.js web app (the dispatcher console).
 *   - Wall windows: one BrowserWindow per (wallPage × monitor), fullscreen.
 *
 * The menu "Pereți video" is built dynamically from the API: each configured
 * wall page becomes an entry; submenu offers opening on the default monitor
 * (saved with the wall) or any other available display.
 */
const path = require("path");
try { require("dotenv").config({ path: path.resolve(__dirname, "../.env") }); } catch {}

const { app, BrowserWindow, screen, Menu, dialog, shell } = require("electron");

const WEB_URL = process.env.WEB_BASE_URL || "http://192.168.1.100:3000";
const TOKEN = process.env.YOLO_INGEST_TOKEN || "dev-token";

const wallWindows = new Map(); // key=`${wallId}:${displayId}` → BrowserWindow

function createConsoleWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: "Dispecerat — Consolă",
    backgroundColor: "#0b0f17",
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(WEB_URL).catch(() => win.loadFile(path.join(__dirname, "fallback.html")));
  win.webContents.on("did-fail-load", () => win.loadFile(path.join(__dirname, "fallback.html")));
  return win;
}

function openWallOnDisplay(wall, display) {
  const key = `${wall.id}:${display.id}`;
  if (wallWindows.has(key)) { wallWindows.get(key).focus(); return; }
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    title: `${wall.name} · Monitor ${display.bounds.width}×${display.bounds.height}`,
    backgroundColor: "#000",
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(`${WEB_URL}/walls/${wall.id}`).catch(() => win.loadFile(path.join(__dirname, "fallback.html")));
  wallWindows.set(key, win);
  win.on("closed", () => wallWindows.delete(key));
}

async function fetchWalls() {
  try {
    const r = await fetch(`${WEB_URL}/api/walls/public`, { headers: { "x-yolo-token": TOKEN } });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) {
    console.error("fetchWalls failed", e.message);
    return [];
  }
}

async function buildMenu() {
  const displays = screen.getAllDisplays();
  const walls = await fetchWalls();

  const wallMenu = walls.length === 0
    ? [{ label: "Niciun perete configurat — creează unul în UI", enabled: false }]
    : walls.map(w => {
        const defaultDisp = displays[w.monitor] || displays[0];
        return {
          label: w.name,
          submenu: [
            {
              label: `▶ Deschide pe monitorul implicit (#${w.monitor + 1})`,
              click: () => openWallOnDisplay(w, defaultDisp),
            },
            { type: "separator" },
            ...displays.map((d, i) => ({
              label: `Monitor #${i + 1} (${d.bounds.width}×${d.bounds.height})${i === w.monitor ? " — implicit" : ""}`,
              click: () => openWallOnDisplay(w, d),
            })),
          ],
        };
      });

  const template = [
    {
      label: "Dispecerat",
      submenu: [
        { label: "Despre", click: () => dialog.showMessageBox({ message: "Dispecerat\nInterguard Group\nv0.1.0" }) },
        { type: "separator" },
        { role: "reload" }, { role: "toggleDevTools" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Pereți video",
      submenu: [
        {
          label: `Reîncarcă lista pereților (${walls.length})`,
          accelerator: "CmdOrCtrl+R",
          click: () => buildMenu(),
        },
        { type: "separator" },
        ...wallMenu,
        { type: "separator" },
        {
          label: "Închide toate ferestrele Wall",
          click: () => { for (const w of wallWindows.values()) try { w.close(); } catch {} wallWindows.clear(); },
        },
        { type: "separator" },
        {
          label: "Configurare pereți (UI)",
          click: () => shell.openExternal(`${WEB_URL}/walls`),
        },
      ],
    },
    {
      label: "Vizualizare",
      submenu: [{ role: "togglefullscreen" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }],
    },
    {
      label: "Help",
      submenu: [{ label: "Deschide consola în browser", click: () => shell.openExternal(WEB_URL) }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  createConsoleWindow();
  await buildMenu();
  // Auto-refresh wall list every 60s so newly created walls show up.
  setInterval(() => buildMenu().catch(() => {}), 60000);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createConsoleWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
