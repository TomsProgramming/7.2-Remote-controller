// Desktop spelscherm: Three.js rendering + Socket.io sync + HUD.
import * as THREE from 'three';

// ── Setup ────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
let ROOM_CODE = (params.get('room') || '').toUpperCase();

const socket = io();

// DOM refs
const statusText = document.getElementById('statusText');
const playerCountEl = document.getElementById('playerCount');
const playersEl = document.getElementById('players');
const roomCodeEl = document.getElementById('roomCode');
const qrImg = document.getElementById('qrImg');
const qrUrl = document.getElementById('qrUrl');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySub = document.getElementById('overlaySub');
const overlayScores = document.getElementById('overlayScores');
const rematchBtn = document.getElementById('rematchBtn');
const killfeed = document.getElementById('killfeed');

function applyRoomCode(code) {
  ROOM_CODE = code;
  roomCodeEl.textContent = code;
  // URL updaten zodat refresh de lobby behoudt
  const newUrl = `${location.pathname}?room=${encodeURIComponent(code)}`;
  history.replaceState({}, '', newUrl);

  // QR-code ophalen
  fetch(`/qr?room=${encodeURIComponent(code)}`)
    .then((r) => r.json())
    .then(({ dataUrl, url }) => {
      qrImg.src = dataUrl;
      qrUrl.textContent = url;
    })
    .catch(() => {
      qrUrl.textContent = 'QR-code kon niet geladen worden.';
    });
}

if (ROOM_CODE) {
  applyRoomCode(ROOM_CODE);
}

// ── Three.js scene ───────────────────────────────────────────────
const ARENA_SIZE = 60;
const HALF = ARENA_SIZE / 2;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x05080f);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05080f, 60, 120);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 60, 55);
camera.lookAt(0, 0, 0);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Lichten
scene.add(new THREE.AmbientLight(0x6a7fb5, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -HALF; sun.shadow.camera.right = HALF;
sun.shadow.camera.top = HALF; sun.shadow.camera.bottom = -HALF;
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 200;
scene.add(sun);

const rimLight = new THREE.DirectionalLight(0xff4d6d, 0.25);
rimLight.position.set(-30, 20, -20);
scene.add(rimLight);

// Vloer
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
  new THREE.MeshStandardMaterial({ color: 0x0e1526, roughness: 0.95, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Grid
const grid = new THREE.GridHelper(ARENA_SIZE, 30, 0x4dabff, 0x1a2640);
grid.position.y = 0.01;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

// Arena wanden (laag, neon)
const wallMat = new THREE.MeshStandardMaterial({
  color: 0x4dabff, emissive: 0x4dabff, emissiveIntensity: 0.6,
  transparent: true, opacity: 0.35,
});
const wallHeight = 2;
const wallThickness = 0.4;
[
  { x: 0, z: HALF, w: ARENA_SIZE, d: wallThickness },
  { x: 0, z: -HALF, w: ARENA_SIZE, d: wallThickness },
  { x: HALF, z: 0, w: wallThickness, d: ARENA_SIZE },
  { x: -HALF, z: 0, w: wallThickness, d: ARENA_SIZE },
].forEach((w) => {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, wallHeight, w.d), wallMat);
  wall.position.set(w.x, wallHeight / 2, w.z);
  scene.add(wall);
});

// ── Drone factory ────────────────────────────────────────────────
function createDroneMesh(colorHex) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex, metalness: 0.5, roughness: 0.35,
    emissive: new THREE.Color(colorHex).multiplyScalar(0.25),
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), bodyMat);
  body.castShadow = true;
  group.add(body);

  // Arms
  const armMat = new THREE.MeshStandardMaterial({ color: 0x222a3a, metalness: 0.8, roughness: 0.3 });
  for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8), armMat);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(dz, dx);
    arm.position.set(dx * 0.5, 0, dz * 0.5);
    arm.castShadow = true;
    group.add(arm);

    // Rotor
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x111820, metalness: 0.9, roughness: 0.2 })
    );
    rotor.position.set(dx * 1.1, 0.22, dz * 1.1);
    rotor.castShadow = true;
    group.add(rotor);
    rotor.userData.spin = true;
  }

  // "Neus" / vizier (richtingaanduiding)
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.6, 8),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 })
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.1, 0.9);
  group.add(nose);

  // Gloed onder de drone
  const glow = new THREE.PointLight(colorHex, 0.8, 6);
  glow.position.y = -0.2;
  group.add(glow);

  return group;
}

// ── State ────────────────────────────────────────────────────────
/** @type {Map<string, {group: THREE.Group, label: THREE.Sprite, color: number, target:{x:number,z:number,r:number}, alive: boolean}>} */
const drones = new Map();
/** @type {Map<number, THREE.Mesh>} */
const bullets = new Map();
let lastState = null;
let localStatus = 'lobby';

// Spritelabel (spelersnaam)
function createNameLabel(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 28px Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(name, 128, 32);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 1, 1);
  sprite.position.y = 2.2;
  sprite.renderOrder = 2;
  return sprite;
}

function getOrCreateDrone(p) {
  let d = drones.get(p.id);
  if (!d) {
    const group = createDroneMesh(p.color);
    group.position.set(p.x, 1, p.z);
    const label = createNameLabel(p.name, p.color);
    group.add(label);
    scene.add(group);
    d = {
      group, label, color: p.color,
      target: { x: p.x, z: p.z, r: p.rotation },
      alive: true,
    };
    drones.set(p.id, d);
  }
  return d;
}

function removeDrone(id) {
  const d = drones.get(id);
  if (!d) return;
  scene.remove(d.group);
  d.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
  });
  drones.delete(id);
}

// Kogels
function spawnBulletMesh(id, x, z, colorHex = 0xffffff) {
  let mesh = bullets.get(id);
  if (mesh) return mesh;
  mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshStandardMaterial({
      color: colorHex, emissive: colorHex, emissiveIntensity: 2,
    })
  );
  mesh.position.set(x, 1.1, z);
  mesh.castShadow = false;
  scene.add(mesh);
  const light = new THREE.PointLight(colorHex, 0.8, 5);
  mesh.add(light);
  bullets.set(id, mesh);
  return mesh;
}

function removeBulletMesh(id) {
  const m = bullets.get(id);
  if (!m) return;
  scene.remove(m);
  m.geometry.dispose();
  m.material.dispose();
  bullets.delete(id);
}

// ── HUD ──────────────────────────────────────────────────────────
function renderPlayerList(players) {
  playersEl.innerHTML = '';
  playerCountEl.textContent = String(players.length);
  for (const p of players) {
    const li = document.createElement('li');
    li.className = 'playerRow' + (p.alive ? '' : ' dead');
    li.innerHTML = `
      <span class="dot" style="background:${p.color};color:${p.color}"></span>
      <span class="name">${escapeHtml(p.name)}</span>
      <span class="kills">${p.kills ?? 0} kills</span>
      <div class="hpBar"><span style="width:${Math.max(p.hp || 0, 0)}%"></span></div>
    `;
    playersEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"]|'/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function addKillMessage(killerName, victimName, killerColor, victimColor) {
  const el = document.createElement('div');
  el.className = 'killMsg';
  el.innerHTML = `
    <span class="killer" style="color:${killerColor}">${escapeHtml(killerName)}</span>
    💥
    <span class="victim" style="color:${victimColor}">${escapeHtml(victimName)}</span>
  `;
  killfeed.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setStatus(text, playing) {
  statusText.textContent = text;
  document.body.classList.toggle('state-playing', !!playing);
}

// ── Socket events ────────────────────────────────────────────────
socket.on('connect', () => {
  if (ROOM_CODE) {
    // Bestaande lobby: probeer te herverbinden
    socket.emit('rejoinAsHost', { code: ROOM_CODE }, (res) => {
      if (!res?.ok) {
        // Lobby bestaat niet meer → maak een nieuwe aan
        createNewLobby();
      }
    });
  } else {
    createNewLobby();
  }
});

function createNewLobby() {
  socket.emit('createRoom', {}, (res) => {
    if (res?.ok) {
      applyRoomCode(res.code);
    } else {
      alert('Kon geen lobby aanmaken. Probeer opnieuw.');
      location.href = '/';
    }
  });
}

socket.on('lobbyUpdate', ({ players, status }) => {
  localStatus = status;
  renderPlayerList(players);

  // Cleanup drones voor vertrokken spelers
  const ids = new Set(players.map((p) => p.id));
  for (const id of Array.from(drones.keys())) {
    if (!ids.has(id)) removeDrone(id);
  }

  if (status === 'lobby') {
    setStatus(players.length >= 1 ? 'Klaar om te starten' : 'Wacht op spelers…', false);
    startBtn.disabled = players.length < 1;
    startBtn.textContent = players.length < 1 ? 'Wacht op spelers…' :
      (players.length < 2 ? 'Start (solo test)' : `Start spel (${players.length})`);
  } else if (status === 'playing') {
    setStatus('Spel bezig', true);
  } else if (status === 'ended') {
    setStatus('Ronde afgelopen', false);
  }
});

socket.on('playerJoined', (p) => {
  // Voeg label-sprite toe via getOrCreateDrone (verschijnt pas visueel tijdens gameState updates)
  getOrCreateDrone(p);
});

socket.on('playerLeft', ({ id }) => {
  removeDrone(id);
});

socket.on('gameStarted', () => {
  overlay.classList.add('hidden');
  setStatus('Spel bezig', true);
});

socket.on('gameState', (state) => {
  lastState = state;

  // Update drones
  const ids = new Set();
  for (const p of state.players) {
    ids.add(p.id);
    const d = getOrCreateDrone(p);
    d.target.x = p.x;
    d.target.z = p.z;
    d.target.r = p.rotation;
    d.alive = p.alive;
    d.group.visible = p.alive;
  }
  for (const id of Array.from(drones.keys())) {
    if (!ids.has(id)) removeDrone(id);
  }

  // Update kogels
  const bulletIds = new Set();
  for (const b of state.bullets) {
    bulletIds.add(b.id);
    const owner = state.players.find((p) => p.id === b.ownerId);
    const color = owner ? new THREE.Color(owner.color).getHex() : 0xffffff;
    const mesh = spawnBulletMesh(b.id, b.x, b.z, color);
    mesh.position.x = b.x;
    mesh.position.z = b.z;
  }
  for (const id of Array.from(bullets.keys())) {
    if (!bulletIds.has(id)) removeBulletMesh(id);
  }

  // Update HUD spelerslijst
  renderPlayerList(state.players);
});

socket.on('hit', ({ targetId, x, z }) => {
  spawnHitEffect(x, z);
});

socket.on('playerDead', ({ id, name, killerName }) => {
  const victim = drones.get(id);
  const killer = Array.from(drones.values()).find((d) =>
    d.group.children.some((c) => c.material?.map?.image?.__ownerName === killerName)
  );
  const victimColor = victim?.color || '#ffffff';
  // pak killer color uit laatste state
  let killerColor = '#ffffff';
  if (lastState) {
    const p = lastState.players.find((pp) => pp.name === killerName);
    if (p) killerColor = p.color;
  }
  addKillMessage(killerName || 'Iemand', name || '???', killerColor, victimColor);
  spawnExplosion(victim?.group?.position);
});

socket.on('gameOver', ({ winnerName, winnerColor, players }) => {
  overlayTitle.textContent = winnerName ? '🏆 Winnaar!' : 'Gelijkspel';
  overlaySub.innerHTML = winnerName
    ? `<span style="color:${winnerColor || '#fff'}; font-weight:700">${escapeHtml(winnerName)}</span> is de laatste drone in de lucht`
    : 'Geen winnaar deze ronde';

  overlayScores.innerHTML = '';
  const sorted = [...(players || [])].sort((a, b) => (b.kills || 0) - (a.kills || 0));
  for (const p of sorted) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <span class="dot" style="background:${p.color}"></span>
      <span class="name">${escapeHtml(p.name)}</span>
      <span class="kills">${p.kills || 0} kills</span>
    `;
    overlayScores.appendChild(row);
  }

  overlay.classList.remove('hidden');
  setStatus('Ronde afgelopen', false);
});

socket.on('roomClosed', () => {
  alert('Lobby is gesloten.');
  location.href = '/';
});

// UI bindings
startBtn.addEventListener('click', () => {
  socket.emit('startGame');
});
backBtn.addEventListener('click', () => {
  if (confirm('Weet je zeker dat je de lobby wilt sluiten?')) location.href = '/';
});
rematchBtn.addEventListener('click', () => {
  socket.emit('returnToLobby');
  overlay.classList.add('hidden');
});

// ── Effecten ─────────────────────────────────────────────────────
function spawnHitEffect(x, z) {
  const sparks = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.9 })
  );
  sparks.position.set(x, 1, z);
  scene.add(sparks);
  let t = 0;
  const anim = () => {
    t += 0.06;
    sparks.scale.setScalar(1 + t * 2);
    sparks.material.opacity = Math.max(0, 0.9 - t);
    if (t < 1) requestAnimationFrame(anim);
    else { scene.remove(sparks); sparks.geometry.dispose(); sparks.material.dispose(); }
  };
  anim();
}

function spawnExplosion(position) {
  if (!position) return;
  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 1 })
  );
  boom.position.copy(position);
  scene.add(boom);
  const light = new THREE.PointLight(0xff6644, 4, 20);
  light.position.copy(position);
  scene.add(light);
  let t = 0;
  const anim = () => {
    t += 0.04;
    boom.scale.setScalar(1 + t * 5);
    boom.material.opacity = Math.max(0, 1 - t);
    light.intensity = Math.max(0, 4 - t * 4);
    if (t < 1) requestAnimationFrame(anim);
    else {
      scene.remove(boom); boom.geometry.dispose(); boom.material.dispose();
      scene.remove(light);
    }
  };
  anim();
}

// ── Render loop met interpolatie ─────────────────────────────────
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Smooth interpolatie naar target positie
  for (const d of drones.values()) {
    const g = d.group;
    const lerp = 1 - Math.pow(0.001, dt); // time-based lerp
    g.position.x += (d.target.x - g.position.x) * lerp;
    g.position.z += (d.target.z - g.position.z) * lerp;
    // Angle interpolate (wrap-safe)
    let diff = d.target.r - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * lerp;

    // Rotor spin + hover bob
    const bob = Math.sin(now * 0.005 + g.position.x) * 0.05;
    g.position.y = 1 + bob;
    g.traverse((o) => {
      if (o.userData?.spin) o.rotation.y += dt * 30;
    });
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
