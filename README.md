# DroneWars — Module 7.2 Remote Controller

Multiplayer drone-gevechtsspel in de browser. Desktop = spelscherm (Three.js), telefoon = controller via QR-code (Nipple.js joysticks + schietknop).

## Links

| | Link |
|--|------|
| Trello board | https://trello.com/b/fby2BVjW/dronewars-module-72-remote-controller |
| FigJam gebruikersstroom | https://www.figma.com/online-whiteboard/create-diagram/ceeb1bf5-dc27-4119-bf49-25409c5523f3 |
| FigJam UI-structuur | https://www.figma.com/online-whiteboard/create-diagram/d2048ccb-28a1-4899-8656-1673201ef464 |

## Documenten

| Document | Locatie |
|----------|---------|
| Plan van Aanpak | [docs/plan-van-aanpak.md](docs/plan-van-aanpak.md) |
| Functioneel Ontwerp | [docs/functioneel-ontwerp.md](docs/functioneel-ontwerp.md) |
| Technisch Ontwerp | [docs/technisch-ontwerp.md](docs/technisch-ontwerp.md) |

## Stack

| Technologie | Doel |
|-------------|------|
| Node.js + Express | Server |
| Socket.io | Real-time communicatie |
| Three.js | 3D-spelscherm |
| Nipple.js | Virtuele joysticks op telefoon |
| qrcode (npm) | QR-code generatie |

## Installeren & starten

```bash
npm install
npm start
```

Open vervolgens op de desktop `http://<ip>:3000` en klik **Nieuwe lobby**.

## Zo speel je (met vrienden)

1. **Host:** opent `http://<ip>:3000` op de desktop en klikt op *Nieuwe lobby*.
   Het spelscherm toont een 4-letter **lobbycode** en een **QR-code**.
2. **Vrienden:** scannen de QR-code met hun telefoon **of** openen zelf
   `http://<ip>:3000` en voeren de lobbycode in. Ze vullen hun naam in en komen in de lobby.
3. **Host:** klikt op *Start spel* zodra iedereen in de lobby staat.
4. Op de telefoon krijgen spelers twee joysticks (links = bewegen, rechts = richten) en een grote schietknop.
5. Laatste drone die overblijft wint. De host kan daarna terug naar de lobby voor een nieuwe ronde.

> Alle spelers moeten op hetzelfde netwerk zitten als de server (of de server moet publiek bereikbaar zijn).

## Deadlines

| Mijlpaal | Datum |
|----------|-------|
| Documenten inleveren | 20 maart 2026 |
| Product inleveren | 16 april 2026 |
| Videopresentatie | 16 april 2026 |
| Retrospective | 18 april 2026 |
