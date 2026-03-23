# Plan van Aanpak — DroneWars

**Module:** 7.2 Remote Controller
**Student:** Tom
**Klas:** 2CSD-WDV
**Datum:** 23 maart 2026

---

## 1. Beschrijving van het idee

DroneWars is een multiplayer drone-gevechtsspel dat in de browser draait. Het spel bestaat uit twee schermen:

- **Spelscherm (desktop/groot scherm):** Een 3D-omgeving gebouwd met Three.js, waarin meerdere spelers tegelijkertijd hun drone besturen en op elkaar kunnen schieten.
- **Controller (telefoon):** Via een QR-code op het spelscherm opent elke speler op zijn telefoon een controllerinterface met twee virtuele joysticks en een schietknop.

Het idee is geïnspireerd door Lucas en past perfect bij de opdracht "Remote Controller": de telefoon fungeert letterlijk als afstandsbediening voor het spel op het grote scherm.

---

## 2. Waarom dit project?

De opdracht vraagt om een remote controller te bouwen waarmee een device op afstand bestuurd kan worden. In plaats van een simpele implementatie wil ik dit uitwerken als een volledig spelconcept, omdat:

- Het technisch uitdagend is (real-time communicatie, 3D-rendering, mobiele touch-input).
- Het een originele toepassing is van de remote-controller-gedachte.
- Het een aantoonbaar product oplevert dat je direct kunt demonstreren.
- Het meerdere moderne webtechnologieën combineert op een zinvolle manier.

---

## 3. Doelstelling

Een werkende, multiplayer drone-shooter maken waarbij:

1. De desktop het spelscherm toont (3D-omgeving met drones).
2. Een QR-code automatisch de juiste controller-URL genereert.
3. De telefoon via twee joysticks en een schietknop de drone bestuurt.
4. De game-state real-time gesynchroniseerd wordt via Socket.io.
5. Drones HP hebben en uit het spel kunnen worden geschoten.

---

## 4. Scope

**In scope:**
- QR-code genereren op spelscherm
- Mobiele controller met twee joysticks (links = beweging, rechts = rotatie) en schietknop
- 3D-spelomgeving met drones
- Real-time multiplayer via WebSockets
- Basisgameplay: bewegen, richten, schieten, HP-systeem

**Buiten scope:**
- Gebruikersaccounts / login
- Persistente statistieken of leaderboard
- Geluid / muziek
- Mobiele app (native)

---

## 5. Randvoorwaarden

- Alle spelers zitten op hetzelfde lokale netwerk (of via een publieke server).
- De telefoon heeft een moderne browser met touch-ondersteuning.
- Node.js is beschikbaar op de server.

---

## 6. Risico's

| Risico | Kans | Impact | Maatregel |
|--------|------|--------|-----------|
| Latency joystick → drone | Middel | Hoog | Beweging client-side verwerken, server corrigeert |
| QR-code werkt niet op LAN | Laag | Middel | IP-adres ook als tekst tonen |
| Three.js performance op low-end device | Middel | Middel | Eenvoudige geometrie gebruiken, geen zware texturen |
| Tijdsgebrek | Hoog | Hoog | MVP eerst: één arena, twee spelers, basisgameplay |
