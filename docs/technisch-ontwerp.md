# Technisch Ontwerp — DroneWars

**Module:** 7.2 Remote Controller
**Student:** Tom
**Klas:** 2CSD-WDV
**Datum:** 23 maart 2026

---

## 1. Architectuuroverzicht

```
┌─────────────────────────────────────────────────────────┐
│                    Node.js / Express                    │
│                                                         │
│  ┌──────────────┐          ┌───────────────────────┐   │
│  │  HTTP Server  │          │   Socket.io Server    │   │
│  │  /           │          │   - game state        │   │
│  │  /controller │          │   - player events     │   │
│  └──────────────┘          └───────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                              │
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│  Desktop Browser │          │   Mobiele Browser   │
│  (spelscherm)   │          │   (controller)      │
│                 │          │                     │
│  Three.js       │◄─────────│  Nipple.js          │
│  QR-code        │  Socket  │  Joystick L + R     │
│  HUD            │          │  Schietknop         │
└─────────────────┘          └─────────────────────┘
```

---

## 2. Technologieën

| Technologie | Versie | Doel |
|-------------|--------|------|
| Node.js | 20+ | Runtime voor de server |
| Express.js | 4.x | HTTP-server, statische bestanden serveren |
| Socket.io | 4.x | Bidirectionele real-time communicatie |
| Three.js | r165+ | 3D-rendering in de browser (spelscherm) |
| Nipple.js | 0.10.x | Virtuele joysticks op mobiel |
| qrcode (npm) | 1.5.x | QR-code genereren met de controller-URL |

---

## 3. Projectstructuur

```
7.2-Remote-controller/
├── server/
│   ├── index.js          # Express + Socket.io server
│   └── game/
│       └── GameLoop.js   # Server-side game loop (autoritatief)
├── public/
│   ├── index.html        # Spelscherm (desktop)
│   ├── controller.html   # Controllerinterface (telefoon)
│   ├── js/
│   │   ├── game.js       # Three.js scene, rendering
│   │   ├── network.js    # Socket.io client (spelscherm)
│   │   └── controller.js # Joystick-logica + Socket.io (telefoon)
│   └── css/
│       └── controller.css
├── docs/
│   ├── plan-van-aanpak.md
│   ├── functioneel-ontwerp.md
│   └── technisch-ontwerp.md
├── package.json
└── .gitignore
```

---

## 4. Real-time communicatie (Socket.io events)

### Van controller → server

| Event | Data | Beschrijving |
|-------|------|--------------|
| `join` | `{ roomCode }` | Speler verbindt met een gameroom |
| `move` | `{ x, y }` | Linker joystick: beweging (-1 tot 1) |
| `rotate` | `{ x, y }` | Rechter joystick: rotatie/kijkrichting |
| `shoot` | — | Schietknop ingedrukt |

### Van server → clients

| Event | Data | Beschrijving |
|-------|------|--------------|
| `gameState` | `{ players, bullets }` | Volledige game state (60x/sec) |
| `playerJoined` | `{ id, color }` | Nieuwe speler verbonden |
| `playerLeft` | `{ id }` | Speler verbroken verbinding |
| `hit` | `{ targetId, damage }` | Kogel raakt drone |
| `playerDead` | `{ id }` | Drone vernietigd |

---

## 5. Server-side game loop

De server is **autoritatief**: alle bewegings- en collision-berekeningen gebeuren op de server om cheating te voorkomen en om de game state consistent te houden voor alle clients.

```
Server-side loop (60 FPS = ~16ms per tick):
1. Verwerk binnenkomende input per speler
2. Update drone-posities (physics: positie += richting * snelheid)
3. Update kogels (lineaire beweging)
4. Collision detection (kogel ↔ drone boundingsphere)
5. Verwijder verlopen kogels
6. Stuur gameState naar alle clients
```

---

## 6. QR-code flow

1. Server start op, detecteert het lokale IP-adres (`os.networkInterfaces()`).
2. Server genereert een QR-code image met URL `http://<ip>:<port>/controller`.
3. QR-code wordt als base64 data-URL naar de desktop-client gestuurd (via Socket.io of als `/qr` endpoint).
4. Desktop toont de QR-code op het scherm.
5. Speler scant met telefoon → browser opent `/controller` automatisch.

---

## 7. Three.js spelscherm

- **Scene:** Vlakke arena met een grondvlak en verlichting (AmbientLight + DirectionalLight).
- **Drones:** `BoxGeometry` of geladen GLTF-model, per speler een unieke kleur (`MeshStandardMaterial`).
- **Kogels:** Kleine `SphereGeometry`, lichte kleur met emissive om ze zichtbaar te maken.
- **Camera:** Vogelperspectief (top-down) of vrije camera met OrbitControls.
- **Rendering loop:** `requestAnimationFrame`, game state ontvangen via Socket.io → drone-posities updaten in Three.js scene.

---

## 8. Controller (mobiel)

- Nipple.js initialiseert twee joysticks in `static` modus:
  - **Links:** beweging (x/y → `move` event)
  - **Rechts:** rotatie (x/y → `rotate` event)
- Schietknop: standaard HTML-button met `touchstart` event listener.
- Throttling: input events worden maximaal 60x per seconde naar de server gestuurd.
- De controller-pagina is volledig fullscreen en heeft `touch-action: none` om scrollen te voorkomen.

---

## 9. Drone physics (server-side)

```javascript
// Vereenvoudigd model
drone.velocity.x += input.move.x * ACCELERATION;
drone.velocity.y += input.move.y * ACCELERATION;
drone.velocity.x *= DRAG; // demping
drone.velocity.y *= DRAG;
drone.position.x += drone.velocity.x;
drone.position.y += drone.velocity.y;
drone.rotation += input.rotate.x * TURN_SPEED;
```

---

## 10. API-overzicht (HTTP)

| Route | Methode | Beschrijving |
|-------|---------|--------------|
| `/` | GET | Serveert spelscherm (index.html) |
| `/controller` | GET | Serveert controllerinterface |
| `/qr` | GET | Geeft QR-code als PNG terug |

---

## 11. Vereisten

- **Browser:** Chrome/Firefox/Safari (modern, WebGL-ondersteuning vereist)
- **Netwerk:** Alle devices op hetzelfde netwerk, of server publiek bereikbaar
- **Node.js:** versie 20 of hoger
- **Scherm desktop:** minimaal 1024×768
- **Scherm telefoon:** minimaal 375px breed, touch-ondersteuning
