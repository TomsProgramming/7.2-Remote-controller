// Mobiele controller: join-flow + Nipple.js joysticks + schietknop.
(() => {
  const socket = io();

  const params = new URLSearchParams(location.search);
  const initialCode = (params.get('room') || '').toUpperCase();

  // ── DOM refs ───────────────────────────────────────────────
  const screenJoin = document.getElementById('screenJoin');
  const screenWait = document.getElementById('screenWait');
  const screenPlay = document.getElementById('screenPlay');
  const screenOver = document.getElementById('screenOver');

  const codeInput = document.getElementById('codeInput');
  const nameInput = document.getElementById('nameInput');
  const joinForm = document.getElementById('joinForm');
  const joinErr = document.getElementById('joinErr');

  const waitCode = document.getElementById('waitCode');
  const youName = document.getElementById('youName');
  const youColor = document.getElementById('youColor');
  const leaveBtn = document.getElementById('leaveBtn');

  const playColor = document.getElementById('playColor');
  const playName = document.getElementById('playName');
  const hpFill = document.getElementById('hpFill');
  const hpText = document.getElementById('hpText');
  const shootBtn = document.getElementById('shootBtn');
  const deadOverlay = document.getElementById('deadOverlay');

  const overTitle = document.getElementById('overTitle');
  const overSub = document.getElementById('overSub');

  // State
  let me = null; // { id, name, color, code }
  let joyMove = null;
  let joyRotate = null;
  let autoFireInterval = null;

  if (initialCode) codeInput.value = initialCode;

  // Herstel opgeslagen naam
  try {
    const saved = localStorage.getItem('dronewars:name');
    if (saved) nameInput.value = saved;
  } catch (_) { /* noop */ }

  // Auto-upper code
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  function showScreen(id) {
    for (const s of [screenJoin, screenWait, screenPlay, screenOver]) {
      s.classList.add('hidden');
    }
    document.getElementById(id).classList.remove('hidden');
  }

  // ── Join ──────────────────────────────────────────────────
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    joinErr.textContent = '';
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();
    if (code.length !== 4) {
      joinErr.textContent = 'Voer een geldige 4-letter lobbycode in.';
      return;
    }
    if (!name) {
      joinErr.textContent = 'Voer je naam in.';
      return;
    }
    try { localStorage.setItem('dronewars:name', name); } catch (_) {}

    socket.emit('joinAsPlayer', { code, name }, (res) => {
      if (!res?.ok) {
        joinErr.textContent = res?.error || 'Kon niet joinen.';
        return;
      }
      me = { id: res.id, name: res.name, color: res.color, code: res.code };
      waitCode.textContent = res.code;
      youName.textContent = res.name;
      youColor.style.background = res.color;
      youColor.style.color = res.color;
      playColor.style.background = res.color;
      playColor.style.color = res.color;
      playName.textContent = res.name;
      showScreen('screenWait');
    });
  });

  leaveBtn.addEventListener('click', () => {
    location.href = '/';
  });

  // ── Game events ───────────────────────────────────────────
  socket.on('connect', () => {
    // Als we al "me" zijn, was het een reconnect → terug naar home
    if (me) {
      // Eenvoudig: herjoinen niet ondersteund, ga terug naar start
      location.reload();
    }
  });

  socket.on('gameStarted', () => {
    showScreen('screenPlay');
    setupJoysticks();
    deadOverlay.classList.add('hidden');
    updateHp(100);
  });

  socket.on('returnedToLobby', () => {
    teardownJoysticks();
    showScreen('screenWait');
  });

  socket.on('gameOver', ({ winnerName, winnerId }) => {
    teardownJoysticks();
    const won = winnerId && me && winnerId === me.id;
    overTitle.textContent = won ? '🏆 Jij hebt gewonnen!' : (winnerName ? 'Ronde afgelopen' : 'Gelijkspel');
    overSub.innerHTML = winnerName
      ? `Winnaar: <strong>${escapeHtml(winnerName)}</strong>`
      : '';
    showScreen('screenOver');
  });

  socket.on('roomClosed', () => {
    alert('De lobby is gesloten.');
    location.href = '/';
  });

  socket.on('hit', ({ targetId, hp }) => {
    if (!me) return;
    if (targetId === me.id) {
      updateHp(hp);
      document.body.classList.add('hit-flash');
      if (navigator.vibrate) navigator.vibrate(60);
      setTimeout(() => document.body.classList.remove('hit-flash'), 300);
    }
  });

  socket.on('playerDead', ({ id }) => {
    if (me && id === me.id) {
      deadOverlay.classList.remove('hidden');
      updateHp(0);
      if (navigator.vibrate) navigator.vibrate([80, 40, 200]);
      stopAutoFire();
    }
  });

  // Toon actuele HP via gameState updates
  socket.on('gameState', (state) => {
    if (!me) return;
    const mine = state.players.find((p) => p.id === me.id);
    if (mine) {
      updateHp(mine.hp);
      if (!mine.alive) deadOverlay.classList.remove('hidden');
      else deadOverlay.classList.add('hidden');
    }
  });

  function updateHp(hp) {
    const v = Math.max(0, Math.min(100, hp));
    hpFill.style.width = v + '%';
    hpText.textContent = String(Math.round(v));
  }

  // ── Joysticks (Nipple.js) ────────────────────────────────
  function setupJoysticks() {
    teardownJoysticks();
    const move = nipplejs.create({
      zone: document.getElementById('joyMove'),
      mode: 'dynamic',
      color: 'rgba(77,171,255,0.9)',
      size: 140,
      restOpacity: 0.8,
      fadeTime: 80,
    });
    const rotate = nipplejs.create({
      zone: document.getElementById('joyRotate'),
      mode: 'dynamic',
      color: 'rgba(255,77,109,0.9)',
      size: 140,
      restOpacity: 0.8,
      fadeTime: 80,
    });

    let lastMoveSend = 0;
    let lastRotateSend = 0;
    const INTERVAL = 1000 / 30; // 30 Hz

    move.on('move', (_evt, data) => {
      const now = performance.now();
      if (now - lastMoveSend < INTERVAL) return;
      lastMoveSend = now;
      // vector: x/y ∈ [-1,1]
      const v = data.vector || { x: 0, y: 0 };
      socket.emit('move', { x: v.x, y: v.y });
    });
    move.on('end', () => socket.emit('move', { x: 0, y: 0 }));

    rotate.on('move', (_evt, data) => {
      const now = performance.now();
      if (now - lastRotateSend < INTERVAL) return;
      lastRotateSend = now;
      const v = data.vector || { x: 0, y: 0 };
      socket.emit('rotate', { x: v.x, y: v.y });
    });
    rotate.on('end', () => socket.emit('rotate', { x: 0, y: 0 }));

    joyMove = move;
    joyRotate = rotate;
  }

  function teardownJoysticks() {
    if (joyMove) { joyMove.destroy(); joyMove = null; }
    if (joyRotate) { joyRotate.destroy(); joyRotate = null; }
    socket.emit('move', { x: 0, y: 0 });
    socket.emit('rotate', { x: 0, y: 0 });
  }

  // ── Schietknop ────────────────────────────────────────────
  function startAutoFire() {
    if (autoFireInterval) return;
    socket.emit('shoot'); // direct eerste shot
    autoFireInterval = setInterval(() => socket.emit('shoot'), 180);
    shootBtn.classList.add('firing');
  }
  function stopAutoFire() {
    if (autoFireInterval) clearInterval(autoFireInterval);
    autoFireInterval = null;
    shootBtn.classList.remove('firing');
  }

  shootBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startAutoFire();
    if (navigator.vibrate) navigator.vibrate(15);
  }, { passive: false });
  shootBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopAutoFire(); }, { passive: false });
  shootBtn.addEventListener('touchcancel', stopAutoFire);
  // Desktop test
  shootBtn.addEventListener('mousedown', startAutoFire);
  shootBtn.addEventListener('mouseup', stopAutoFire);
  shootBtn.addEventListener('mouseleave', stopAutoFire);

  // Voorkom pinch-zoom / scroll
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  function escapeHtml(s) {
    return String(s).replace(/[&<>\"]|'/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
})();
