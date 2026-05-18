# Sempral SEKA Sync Agent — Windows 7+

Acest agent rulează pe **PC-ul cu Sempral SEKA** (Windows 7+) și sincronizează
automat clienții, obiectivele, contactele și istoricul evenimentelor din DB-ul
SQL Server local către aplicația Dispecerat de pe `192.168.1.100`.

---

## Pas 1 — Descarcă pe PC-ul Sempral

În browser pe PC-ul Sempral, deschide:
```
http://192.168.1.100:3000/downloads/sempral-sync-kit.zip
```

Dezarhivează în `C:\sempral-sync\`.

## Pas 2 — Rulează discovery (10 secunde)

Deschide **PowerShell** și rulează:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
cd C:\sempral-sync
.\01-discover.ps1
```

Va detecta:
- Toate serviciile SQL Server instalate
- Toate instanțele
- Bazele de date existente
- Tabelele candidate Sempral (Clients, Subscribers, Events, etc.)
- Coloanele și numărul de rânduri din fiecare

Output: `C:\sempral-sync\discovery.txt`

**Trimite-mi conținutul `discovery.txt`** (copy-paste sau atașează fișierul).

## Pas 3 — Sync customizat (după discovery)

Cu datele din `discovery.txt`, generez `02-sync.ps1` cu interogările exacte
pentru schema ta. Te ghidez să-l rulezi o singură dată ca să fac importul inițial.

## Pas 4 — Sync automat ca task programat

Cu `04-install-task.ps1` (generat de mine după discovery), instalez:
- Task Windows Scheduler care rulează `02-sync.ps1` la fiecare **5 minute**
- Log în `C:\sempral-sync\sync.log`
- Doar diferențele (idempotent)

---

## Troubleshooting

- **Dacă PowerShell zice „cannot be loaded"**: rulează ca Administrator și execută `Set-ExecutionPolicy RemoteSigned`.
- **Dacă SQL nu poate fi accesat cu Windows Auth**: editează `01-discover.ps1` și pune `User Id=sa;Password=...` în connection string (dacă știi credentialele SQL).
- **Dacă firewall blochează agent-ul**: agent-ul nu acceptă conexiuni inbound, doar trimite spre `http://192.168.1.100:3000` outbound. Verifică că PC-ul Sempral poate ajunge la `192.168.1.100`.
