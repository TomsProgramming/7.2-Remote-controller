# Functioneel Ontwerp — DroneWars

**Module:** 7.2 Remote Controller
**Student:** Tom
**Klas:** 2CSD-WDV
**Datum:** 23 maart 2026

---

## 1. Beschrijving

DroneWars is een multiplayer browsergebaseerd drone-gevechtsspel. Er zijn twee typen schermen:

1. **Spelscherm** – wordt geopend op de desktop of een groot scherm. Hier is de 3D-arena zichtbaar.
2. **Controller** – wordt geopend op de telefoon via een QR-code. Dit is de afstandsbediening.

---

## 2. Wireframes

### 2.1 Spelscherm (Desktop)

```
┌──────────────────────────────────────────────────────────┐
│                    DroneWars                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              3D ARENA (Three.js)                   │  │
│  │                                                    │  │
│  │    [drone speler 1]                                │  │
│  │                        [drone speler 2]            │  │
│  │                                                    │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────┐    ┌────────────────────────────────┐  │
│  │  Spelers: 0  │    │  Scan QR-code met je telefoon  │  │
│  │  ────────    │    │  ┌──────────────────────────┐  │  │
│  │  P1: ████░  │    │  │                          │  │  │
│  │  P2: ████░  │    │  │      [QR-CODE IMAGE]     │  │  │
│  └──────────────┘    │  │                          │  │  │
│                      │  └──────────────────────────┘  │  │
│                      │  http://192.168.x.x:3000/ctrl  │  │
│                      └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Elementen:**
- 3D-arena neemt het grootste deel van het scherm in.
- Linksonder: spelerslijst met HP-balken per speler.
- Rechtsonder: QR-code paneel + URL als tekst (fallback).

---

### 2.2 Controller (Telefoon — staand)

```
┌───────────────────────┐
│      DRONEWARS        │
│    Controller P1      │
├───────────────────────┤
│                       │
│                       │
│   ┌─────┐   ┌─────┐   │
│   │  ↑  │   │  ↑  │   │
│   │← ● →│   │← ● →│   │
│   │  ↓  │   │  ↓  │   │
│   └─────┘   └─────┘   │
│  BEWEGEN    RICHTEN    │
│                       │
│   ┌───────────────┐   │
│   │   💥 SCHIETEN  │   │
│   └───────────────┘   │
│                       │
│  HP: ████████░░  80%  │
└───────────────────────┘
```

**Elementen:**
- Bovenaan: spelersnaam / -nummer.
- Midden: twee circulaire joysticks naast elkaar.
  - **Links:** beweging (vooruit/achteruit/links/rechts).
  - **Rechts:** richting (de drone roteren/kijkrichting aanpassen).
- Onderaan: grote schietknop (gemakkelijk te bereiken met duim).
- Onderin: eigen HP-balk zodat speler zijn eigen status kent.

---

## 3. Functionaliteiten

### 3.1 QR-code verbinding

| # | Functionaliteit | Beschrijving |
|---|----------------|--------------|
| F01 | QR-code genereren | Bij opstarten genereert de server een QR-code met de controller-URL. |
| F02 | QR-code tonen | De QR-code wordt zichtbaar op het spelscherm. |
| F03 | URL als tekst | Naast de QR-code staat ook de URL als tekst, als fallback. |
| F04 | Controller openen | Scannen van de QR-code opent direct de controller in de browser. |

### 3.2 Multiplayer verbinding

| # | Functionaliteit | Beschrijving |
|---|----------------|--------------|
| F05 | Speler verbinden | Bij openen van de controller-URL wordt de speler toegevoegd aan de game. |
| F06 | Speler kleur | Elke speler krijgt automatisch een unieke kleurcode voor zijn drone. |
| F07 | Speler disconnect | Als een speler de verbinding verbreekt, verdwijnt de drone van het scherm. |
| F08 | Max spelers | De game ondersteunt minimaal 2 en maximaal 4 spelers tegelijkertijd. |

### 3.3 Drone besturen

| # | Functionaliteit | Beschrijving |
|---|----------------|--------------|
| F09 | Bewegen (joystick L) | Linker joystick bestuurt de horizontale beweging van de drone. |
| F10 | Richten (joystick R) | Rechter joystick bepaalt de kijkrichting/rotatie van de drone. |
| F11 | Schieten (knop) | Bij indrukken van de schietknop vuurt de drone een kogel af. |
| F12 | Drone physics | Drones hebben massa en remmen geleidelijk af (geen abrupte stop). |
| F13 | Arena grenzen | Drones kunnen de arena niet verlaten; ze stuiteren terug bij de rand. |

### 3.4 Combat

| # | Functionaliteit | Beschrijving |
|---|----------------|--------------|
| F14 | Kogels | Kogels bewegen in een rechte lijn na afvuren. |
| F15 | Hitdetectie | Als een kogel een drone raakt, verliest de drone HP. |
| F16 | HP-systeem | Elke drone begint met 100 HP. |
| F17 | Drone vernietigd | Bij 0 HP wordt de drone verwijderd van het speelveld. |
| F18 | Feedbackmelding | Op het spelscherm verschijnt een melding als een speler wordt uitgeschakeld. |

### 3.5 HUD / Interface

| # | Functionaliteit | Beschrijving |
|---|----------------|--------------|
| F19 | HP-balk spelscherm | Per speler is een HP-balk zichtbaar op het spelscherm. |
| F20 | HP-balk controller | De eigen HP is ook zichtbaar op de controller. |
| F21 | Spelerslijst | Het spelscherm toont hoeveel spelers er verbonden zijn. |

---

## 4. Gebruikersstromen

### 4.1 Speler verbindt voor het eerst

```
Desktop start game
  → Server genereert QR-code
  → QR-code zichtbaar op spelscherm
  → Speler scant QR-code met telefoon
  → Controller opent in browser
  → Speler verschijnt in de arena
  → Drone zichtbaar op spelscherm
```

### 4.2 Speler schiet op tegenstander

```
Speler drukt schietknop op controller
  → "shoot"-event naar server
  → Server maakt kogel aan
  → Kogel beweegt via server-side game loop
  → Kogel raakt tegenstander
  → Server berekent HP-verlies
  → "gameState" update naar alle clients
  → HP-balk spelscherm + controller updates
```

---

## 5. FigJam gebruikersstroom

De volledige gebruikersstroom en Socket.io communicatie tussen desktop, server en telefoon is uitgewerkt in FigJam:

> **[DroneWars — Gebruikersstroom & Game Flow (FigJam)](https://www.figma.com/online-whiteboard/create-diagram/ceeb1bf5-dc27-4119-bf49-25409c5523f3?utm_source=claude&utm_content=edit_in_figjam)**

Het diagram toont:
- Hoe de QR-code gegenereerd en getoond wordt
- Hoe een speler verbindt via de controller
- De Socket.io events bij bewegen, richten en schieten
- HP-verlies en drone vernietigen
- Disconnect afhandeling

## 6. Figma wireframes

De UI-structuur van beide schermen is uitgewerkt in FigJam:

> **[DroneWars — UI Wireframe Structuur (FigJam)](https://www.figma.com/online-whiteboard/create-diagram/d2048ccb-28a1-4899-8656-1673201ef464?utm_source=claude&utm_content=edit_in_figjam)**

Het diagram toont de componentstructuur van:
- **Spelscherm (1920×1080):** 3D arena, QR-code paneel, spelerslijst, HP-balken per speler, kill-melding overlay
- **Controllerinterface (390×844 — iPhone 14):** header met spelersnaam, linker joystick (bewegen), rechter joystick (richten), schietknop, eigen HP-balk
- **Verbindingsflow:** QR-code scannen → Socket.io join → drone in arena

> *(Hoge-fidelity UI-wireframes uitwerken in Figma — link hier toevoegen)*
