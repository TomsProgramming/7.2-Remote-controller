// Autoritatieve server-side game loop voor DroneWars.
// Verwerkt input, physics, kogels, collisions en broadcast gameState.

const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;

export const ARENA_SIZE = 60; // totale breedte van de arena
const HALF = ARENA_SIZE / 2;

const ACCELERATION = 0.035;
const MAX_SPEED = 0.55;
const DRAG = 0.9;
const TURN_SPEED = 0.055;

const BULLET_SPEED = 1.2;
const BULLET_LIFETIME_MS = 2000;
const BULLET_RADIUS = 0.25;
const SHOOT_COOLDOWN_MS = 220;
const BULLET_DAMAGE = 12;

const DRONE_RADIUS = 1.1;
const RESPAWN_MS = 0; // geen respawn – deathmatch tot 1 over

export class GameLoop {
  constructor(room, io) {
    this.room = room;
    this.io = io;
    /** @type {Bullet[]} */
    this.bullets = [];
    this.nextBulletId = 1;
    this.interval = null;
    this.running = false;
    this.startedAt = 0;
  }

  start() {
    // Spawn spelers in een cirkel rond het midden
    const list = Array.from(this.room.players.values());
    const n = list.length;
    list.forEach((p, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2;
      p.x = Math.cos(angle) * (HALF - 8);
      p.z = Math.sin(angle) * (HALF - 8);
      p.vx = 0;
      p.vz = 0;
      p.rotation = Math.atan2(-p.x, -p.z); // richt drone naar het midden
      p.hp = 100;
      p.alive = true;
      p.kills = 0;
      p.lastShot = 0;
    });

    this.bullets = [];
    this.running = true;
    this.startedAt = Date.now();
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  playerShoot(player) {
    if (!this.running) return;
    if (!player.alive) return;
    const now = Date.now();
    if (now - player.lastShot < SHOOT_COOLDOWN_MS) return;
    player.lastShot = now;

    // Richting waarin de drone kijkt (rotation=0 → +Z)
    const dx = Math.sin(player.rotation);
    const dz = Math.cos(player.rotation);

    /** @type {Bullet} */
    const bullet = {
      id: this.nextBulletId++,
      ownerId: player.id,
      x: player.x + dx * (DRONE_RADIUS + 0.3),
      z: player.z + dz * (DRONE_RADIUS + 0.3),
      vx: dx * BULLET_SPEED,
      vz: dz * BULLET_SPEED,
      spawnTime: now,
    };
    this.bullets.push(bullet);

    // Direct event zodat clients een muzzle-flash / geluid kunnen doen
    this.io.to(`room:${this.room.code}`).emit('bulletSpawn', {
      id: bullet.id,
      ownerId: bullet.ownerId,
      x: bullet.x,
      z: bullet.z,
      vx: bullet.vx,
      vz: bullet.vz,
    });
  }

  tick() {
    if (!this.running) return;
    const now = Date.now();

    // ── Update spelers ────────────────────────────────────────
    for (const p of this.room.players.values()) {
      if (!p.alive) continue;

      // Rotatie (rechter joystick, x = links/rechts draaien)
      p.rotation -= p.input.rotate.x * TURN_SPEED;

      // Beweging (linker joystick, y = vooruit/achter, x = strafe)
      const forward = p.input.move.y;
      const strafe = p.input.move.x;

      // Richting waarin de drone kijkt
      const fx = Math.sin(p.rotation);
      const fz = Math.cos(p.rotation);
      // Loodrecht (strafe)
      const sx = Math.cos(p.rotation);
      const sz = -Math.sin(p.rotation);

      const ax = (fx * forward + sx * strafe) * ACCELERATION;
      const az = (fz * forward + sz * strafe) * ACCELERATION;

      p.vx = (p.vx || 0) + ax;
      p.vz = (p.vz || 0) + az;

      // Cap snelheid
      const speed = Math.hypot(p.vx, p.vz);
      if (speed > MAX_SPEED) {
        p.vx = (p.vx / speed) * MAX_SPEED;
        p.vz = (p.vz / speed) * MAX_SPEED;
      }

      p.x += p.vx;
      p.z += p.vz;

      // Drag
      p.vx *= DRAG;
      p.vz *= DRAG;

      // Arena grenzen – stuiter zacht terug
      if (p.x > HALF - DRONE_RADIUS) { p.x = HALF - DRONE_RADIUS; p.vx *= -0.4; }
      if (p.x < -HALF + DRONE_RADIUS) { p.x = -HALF + DRONE_RADIUS; p.vx *= -0.4; }
      if (p.z > HALF - DRONE_RADIUS) { p.z = HALF - DRONE_RADIUS; p.vz *= -0.4; }
      if (p.z < -HALF + DRONE_RADIUS) { p.z = -HALF + DRONE_RADIUS; p.vz *= -0.4; }
    }

    // ── Update kogels ─────────────────────────────────────────
    const remaining = [];
    for (const b of this.bullets) {
      b.x += b.vx;
      b.z += b.vz;

      if (now - b.spawnTime > BULLET_LIFETIME_MS) continue;
      if (Math.abs(b.x) > HALF || Math.abs(b.z) > HALF) continue;

      // Hit-detectie
      let hit = false;
      for (const p of this.room.players.values()) {
        if (!p.alive) continue;
        if (p.id === b.ownerId) continue;
        const dx = p.x - b.x;
        const dz = p.z - b.z;
        if (dx * dx + dz * dz < (DRONE_RADIUS + BULLET_RADIUS) ** 2) {
          p.hp -= BULLET_DAMAGE;
          hit = true;
          this.io.to(`room:${this.room.code}`).emit('hit', {
            targetId: p.id,
            damage: BULLET_DAMAGE,
            hp: Math.max(p.hp, 0),
            x: p.x, z: p.z,
          });
          if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
            const shooter = this.room.players.get(b.ownerId);
            if (shooter) shooter.kills += 1;
            this.io.to(`room:${this.room.code}`).emit('playerDead', {
              id: p.id,
              name: p.name,
              killerId: b.ownerId,
              killerName: shooter?.name || 'Onbekend',
            });
          }
          break;
        }
      }
      if (!hit) remaining.push(b);
    }
    this.bullets = remaining;

    // ── Win-check ─────────────────────────────────────────────
    const alive = Array.from(this.room.players.values()).filter((p) => p.alive);
    const totalPlayers = this.room.players.size;
    const shouldEnd =
      (totalPlayers >= 2 && alive.length <= 1) ||
      (totalPlayers === 1 && alive.length === 0);

    if (shouldEnd) {
      const winner = alive[0] || null;
      this.running = false;
      this.stop();
      this.room.status = 'ended';
      this.io.to(`room:${this.room.code}`).emit('gameOver', {
        winnerId: winner?.id || null,
        winnerName: winner?.name || null,
        winnerColor: winner?.color || null,
        players: Array.from(this.room.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          kills: p.kills,
          alive: p.alive,
        })),
      });
      return;
    }

    // ── Broadcast game state ──────────────────────────────────
    this.io.to(`room:${this.room.code}`).emit('gameState', {
      t: now,
      players: Array.from(this.room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        z: p.z,
        rotation: p.rotation,
        hp: p.hp,
        alive: p.alive,
        kills: p.kills,
      })),
      bullets: this.bullets.map((b) => ({
        id: b.id,
        x: b.x,
        z: b.z,
        ownerId: b.ownerId,
      })),
    });
  }
}

/** @typedef {{id:number, ownerId:string, x:number, z:number, vx:number, vz:number, spawnTime:number}} Bullet */
