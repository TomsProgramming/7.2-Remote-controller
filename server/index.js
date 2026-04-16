import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import QRCode from 'qrcode';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameLoop } from './game/GameLoop.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*' },
});

// Serveer de statische front-end vanuit /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Detecteer het lokale IP-adres zodat de QR-code naar het juiste adres linkt
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIP();
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;

// ── Lobby state ────────────────────────────────────────────────
/** @type {Map<string, Room>} */
const rooms = new Map();

const COLORS = ['#ff4d6d', '#4dabff', '#4dff88', '#ffd24d', '#c14dff', '#ff914d'];
const MAX_PLAYERS = 6;

function generateRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  } while (rooms.has(code));
  return code;
}

function serializePlayer(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: p.hp,
    alive: p.alive,
    kills: p.kills,
    x: p.x,
    z: p.z,
    rotation: p.rotation,
  };
}

function broadcastLobby(code) {
  const room = rooms.get(code);
  if (!room) return;
  io.to(`room:${code}`).emit('lobbyUpdate', {
    code,
    status: room.status,
    players: Array.from(room.players.values()).map(serializePlayer),
  });
}

// ── REST endpoint voor QR-code ────────────────────────────────
app.get('/qr', async (req, res) => {
  const room = String(req.query.room || '').toUpperCase();
  const target = room
    ? `${BASE_URL}/controller.html?room=${encodeURIComponent(room)}`
    : `${BASE_URL}/controller.html`;
  try {
    const dataUrl = await QRCode.toDataURL(target, { width: 320, margin: 1 });
    res.json({ url: target, dataUrl, baseUrl: BASE_URL });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/info', (_req, res) => {
  res.json({ baseUrl: BASE_URL, ip: LOCAL_IP, port: PORT });
});

// ── Socket.io ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let clientType = null; // 'host' | 'player'

  const leaveCurrentRoom = () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) {
      currentRoom = null;
      return;
    }

    if (clientType === 'player') {
      room.players.delete(socket.id);
      io.to(`room:${room.code}`).emit('playerLeft', { id: socket.id });
      broadcastLobby(room.code);
      // Als de game bezig is en er geen spelers meer over zijn, stop de game
      if (room.status === 'playing' && room.players.size === 0 && room.game) {
        room.game.stop();
        room.status = 'lobby';
      }
    } else if (clientType === 'host' && socket.id === room.hostId) {
      // Host weg → grace period, host kan binnen 15s herverbinden (refresh).
      console.log(`[room] ${room.code} host disconnect, wacht 15s op reconnect…`);
      room.closeTimer = setTimeout(() => {
        if (rooms.get(room.code) !== room) return;
        if (room.hostId !== socket.id) return; // andere host heeft overgenomen
        if (room.game) room.game.stop();
        io.to(`room:${room.code}`).emit('roomClosed');
        rooms.delete(room.code);
        console.log(`[room] ${room.code} gesloten (host niet teruggekomen)`);
      }, 15000);
    }
    currentRoom = null;
  };

  // Host maakt een nieuwe lobby aan
  socket.on('createRoom', (_payload, cb) => {
    const code = generateRoomCode();
    const room = {
      code,
      hostId: socket.id,
      players: new Map(),
      status: 'lobby',
      game: null,
    };
    rooms.set(code, room);
    socket.join(`room:${code}`);
    currentRoom = code;
    clientType = 'host';
    console.log(`[room] ${code} aangemaakt`);
    cb?.({ ok: true, code, baseUrl: BASE_URL });
    broadcastLobby(code);
  });

  // Bestaande host herverbindt (bij refresh)
  socket.on('rejoinAsHost', ({ code }, cb) => {
    const room = rooms.get(code);
    if (!room) {
      cb?.({ ok: false, error: 'Lobby niet gevonden' });
      return;
    }
    if (room.closeTimer) {
      clearTimeout(room.closeTimer);
      room.closeTimer = null;
    }
    room.hostId = socket.id;
    socket.join(`room:${code}`);
    currentRoom = code;
    clientType = 'host';
    cb?.({ ok: true, code, baseUrl: BASE_URL });
    broadcastLobby(code);
  });

  // Speler joint via controller
  socket.on('joinAsPlayer', ({ code, name }, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      cb?.({ ok: false, error: 'Lobby niet gevonden' });
      return;
    }
    if (room.status === 'playing') {
      cb?.({ ok: false, error: 'Game is al bezig, wacht tot de volgende ronde' });
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      cb?.({ ok: false, error: 'Lobby is vol' });
      return;
    }

    const usedColors = new Set(Array.from(room.players.values()).map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c)) || COLORS[room.players.size % COLORS.length];

    const safeName = (name || '').toString().trim().slice(0, 16) || `Speler ${room.players.size + 1}`;

    const player = {
      id: socket.id,
      name: safeName,
      color,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      rotation: 0,
      hp: 100,
      alive: true,
      kills: 0,
      lastShot: 0,
      input: { move: { x: 0, y: 0 }, rotate: { x: 0, y: 0 } },
    };
    room.players.set(socket.id, player);
    socket.join(`room:${code}`);
    currentRoom = code;
    clientType = 'player';

    console.log(`[room] ${code} ← ${safeName} (${socket.id.slice(0, 4)})`);
    cb?.({ ok: true, id: socket.id, color, name: safeName, code });
    io.to(`room:${code}`).emit('playerJoined', serializePlayer(player));
    broadcastLobby(code);
  });

  // Host start de game
  socket.on('startGame', () => {
    const room = rooms.get(currentRoom);
    if (!room || socket.id !== room.hostId) return;
    if (room.players.size < 1) return;
    if (room.status === 'playing') return;

    room.status = 'playing';
    room.game = new GameLoop(room, io);
    room.game.start();
    io.to(`room:${room.code}`).emit('gameStarted');
    broadcastLobby(room.code);
    console.log(`[room] ${room.code} game gestart met ${room.players.size} spelers`);
  });

  // Host brengt iedereen terug naar de lobby (na game over)
  socket.on('returnToLobby', () => {
    const room = rooms.get(currentRoom);
    if (!room || socket.id !== room.hostId) return;
    if (room.game) room.game.stop();
    room.status = 'lobby';
    for (const p of room.players.values()) {
      p.hp = 100;
      p.alive = true;
      p.kills = 0;
      p.vx = 0;
      p.vz = 0;
    }
    io.to(`room:${room.code}`).emit('returnedToLobby');
    broadcastLobby(room.code);
  });

  // Speler input
  socket.on('move', (data) => {
    if (clientType !== 'player') return;
    const room = rooms.get(currentRoom);
    const player = room?.players.get(socket.id);
    if (!player) return;
    player.input.move = {
      x: clamp(Number(data?.x) || 0, -1, 1),
      y: clamp(Number(data?.y) || 0, -1, 1),
    };
  });

  socket.on('rotate', (data) => {
    if (clientType !== 'player') return;
    const room = rooms.get(currentRoom);
    const player = room?.players.get(socket.id);
    if (!player) return;
    player.input.rotate = {
      x: clamp(Number(data?.x) || 0, -1, 1),
      y: clamp(Number(data?.y) || 0, -1, 1),
    };
  });

  socket.on('shoot', () => {
    if (clientType !== 'player') return;
    const room = rooms.get(currentRoom);
    const player = room?.players.get(socket.id);
    if (!room || !player || !room.game) return;
    room.game.playerShoot(player);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom();
  });
});

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║          🚁  DroneWars server  🚁         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Spelscherm :  ${BASE_URL}`);
  console.log(`  Controller :  ${BASE_URL}/controller.html`);
  console.log('');
});
