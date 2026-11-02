const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const shopPanel = document.getElementById('shopPanel');
const startBtn = document.getElementById('startBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
const upgradeButtons = [...document.querySelectorAll('.upgrade-btn')];
const touchButtons = [...document.querySelectorAll('.dpad [data-key]')];
const touchCast = document.getElementById('touchCast');

const state = {
  mode: 'title',
  day: 1,
  gold: 18,
  energy: 100,
  fishCaughtToday: 0,
  needForDay: 3,
  time: 0,
  message: 'Cast into the moonlit shallows.',
  player: {
    x: 230,
    y: 430,
    speed: 170,
    radius: 18,
    tilt: 0
  },
  world: {
    fish: [],
    ripples: [],
    splashes: [],
    clouds: []
  },
  cast: null,
  activeCatch: null,
  streak: 0,
  upgrades: {
    line: 0,
    bait: 0,
    boat: 0,
    luck: 0
  }
};

const keys = {};
const pointer = { x: 0, y: 0, down: false, over: false };
const species = [
  { name: 'Sun Carp', color: '#f8d977', value: 16, bias: 0.25 },
  { name: 'Moon Pike', color: '#7ae7d1', value: 22, bias: 0.45 },
  { name: 'Lavender Eel', color: '#d8b8ff', value: 28, bias: 0.7 },
  { name: 'Amber Tuna', color: '#ffb070', value: 34, bias: 0.85 },
  { name: 'Pearl Ray', color: '#dfe8ff', value: 42, bias: 1.1 },
  { name: 'Ember Shark', color: '#ff7a90', value: 58, bias: 1.5 }
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomSpecies() {
  const luck = state.upgrades.luck;
  const weights = species.map((fish, index) => (1 / (1 + fish.bias * 3)) * (1 + luck * index * 0.35));
  const roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let total = 0;

  for (let index = 0; index < species.length; index += 1) {
    total += weights[index];
    if (roll < total) return species[index];
  }

  return species[species.length - 1];
}

function resetWorld() {
  state.world.fish = Array.from({ length: 12 }, () => {
    const kind = randomSpecies();
    return {
      x: rand(90, canvas.width - 120),
      y: rand(90, canvas.height - 90),
      vx: rand(-22, 22),
      vy: rand(-18, 18),
      size: rand(14, 28),
      kind,
      bob: rand(0, Math.PI * 2),
      pulse: rand(0, 1)
    };
  });

  state.world.clouds = Array.from({ length: 6 }, () => ({
    x: rand(0, canvas.width),
    y: rand(30, 160),
    r: rand(18, 52),
    drift: rand(8, 26),
    alpha: rand(0.12, 0.28)
  }));

  state.world.ripples = [];
  state.world.splashes = [];
}

function beginRun() {
  state.mode = 'playing';
  state.day = 1;
  state.gold = 18;
  state.energy = 100;
  state.fishCaughtToday = 0;
  state.needForDay = 3;
  state.message = 'Cast into the moonlit shallows.';
  state.activeCatch = null;
  state.cast = null;
  state.streak = 0;

  Object.keys(state.upgrades).forEach((key) => {
    state.upgrades[key] = 0;
  });

  state.player.x = 230;
  state.player.y = 430;
  state.player.speed = 170;
  resetWorld();
  overlay.classList.add('hidden');
  overlay.classList.remove('visible');
  shopPanel.classList.add('hidden');
  shopPanel.classList.remove('visible');
}

function buyUpgrade(type) {
  const prices = { line: 18, bait: 20, boat: 24, luck: 26 };
  const cost = prices[type];
  if (state.gold < cost) {
    state.message = 'Not enough coin for that upgrade.';
    return;
  }

  state.gold -= cost;
  state.upgrades[type] += 1;
  state.message = `${type[0].toUpperCase() + type.slice(1)} upgraded.`;

  if (type === 'boat') {
    state.player.speed *= 1.12;
  }
}

function nextDay() {
  state.day += 1;
  state.fishCaughtToday = 0;
  state.needForDay = Math.min(6, 3 + Math.floor(state.day / 2));
  state.message = `Day ${state.day}: the water is getting lively.`;
  state.activeCatch = null;
  state.cast = null;
  state.player.x = 230;
  state.player.y = 430;
  resetWorld();
  shopPanel.classList.add('hidden');
  shopPanel.classList.remove('visible');
  overlay.classList.add('hidden');
  overlay.classList.remove('visible');
  state.mode = 'playing';
}

function updatePlayer(dt) {
  const moveX = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  const moveY = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);

  if (moveX || moveY) {
    const len = Math.hypot(moveX, moveY) || 1;
    state.player.x += (moveX / len) * state.player.speed * dt;
    state.player.y += (moveY / len) * state.player.speed * dt;
  }

  state.player.x = clamp(state.player.x, 40, canvas.width - 40);
  state.player.y = clamp(state.player.y, 80, canvas.height - 50);
}

function spawnRipple(x, y) {
  state.world.ripples.push({ x, y, r: 8, life: 0, max: 62 });
}

function castLine() {
  if (state.cast) return;
  const x = state.player.x;
  const y = state.player.y;
  state.cast = {
    x,
    y,
    targetX: clamp(x + rand(-140, 140), 60, canvas.width - 60),
    targetY: clamp(y + rand(-120, 80), 60, canvas.height - 80),
    progress: 0,
    length: 0,
    success: false,
    pull: 0,
    hooked: false
  };
  spawnRipple(x, y);
  state.message = 'Cast out and let the line settle.';
}

function maybeHookFish() {
  if (!state.cast || state.cast.hooked) return;

  const biteChance = 0.14 + state.upgrades.bait * 0.09 + state.upgrades.luck * 0.04;
  const spawnFish = Math.random() < biteChance;
  if (spawnFish && state.world.fish.length > 0) {
    const target = state.world.fish[Math.floor(Math.random() * state.world.fish.length)];
    state.activeCatch = {
      fish: target,
      pull: 0,
      progress: 0,
      meter: 0.5,
      min: 0.32,
      max: 0.68,
      tension: 0,
      reward: 0,
      successful: false
    };
    state.cast.hooked = true;
    state.message = `A ${target.kind.name} took the bait!`;
    state.streak += 1;
  }
}

function startReel(dt) {
  const catchState = state.activeCatch;
  if (!catchState || catchState.successful) return;

  const fish = catchState.fish.kind;
  const holdingReel = pointer.down || keys[' '];
  const safeZone = 0.5;
  const inZone = catchState.meter >= catchState.min && catchState.meter <= catchState.max;

  if (holdingReel && inZone) {
    catchState.progress += dt * (0.32 + state.upgrades.line * 0.04);
    catchState.tension = Math.max(0, catchState.tension - dt * 0.45);
  } else if (holdingReel) {
    catchState.tension += dt * 0.55;
  } else {
    catchState.tension = Math.max(0, catchState.tension - dt * 0.18);
  }

  catchState.pull = catchState.tension;
  catchState.reward = fish.value * catchState.progress;

  if (catchState.tension > 1.2) {
    state.message = `${fish.name} slipped away. Try reeling only in the green zone.`;
    state.activeCatch = null;
    state.cast = null;
    state.streak = 0;
    return;
  }

  if (catchState.progress >= 1) {
    const extra = state.upgrades.luck * 0.18;
    const value = Math.round((fish.value + extra * fish.value) * (1 + state.day * 0.08));
    state.gold += value;
    state.fishCaughtToday += 1;
    state.energy = Math.max(0, state.energy - 8);
    state.message = `Caught ${fish.name} for ${value} coins!`;
    state.world.fish = state.world.fish.filter((f) => f !== catchState.fish);
    if (state.world.fish.length < 7) {
      const kind = randomSpecies();
      state.world.fish.push({
        x: rand(80, canvas.width - 80),
        y: rand(110, canvas.height - 100),
        vx: rand(-18, 18),
        vy: rand(-16, 16),
        size: rand(14, 28),
        kind,
        bob: rand(0, Math.PI * 2),
        pulse: rand(0, 1)
      });
    }
    if (state.fishCaughtToday >= state.needForDay) {
      state.mode = 'shop';
      shopPanel.classList.remove('hidden');
      shopPanel.classList.add('visible');
      overlay.classList.remove('visible');
      overlay.classList.add('hidden');
      state.message = 'Your catch is enough for today. Visit the harbor market.';
    }
    state.activeCatch = null;
    state.cast = null;
  }
}

function updateCast(dt) {
  if (!state.cast) return;
  state.cast.progress += dt * 0.9;
  state.cast.length = Math.min(1, state.cast.progress);

  if (state.cast.progress > 1.15) {
    maybeHookFish();
  }

  if (state.cast.progress > 1.6) {
    if (!state.activeCatch) {
      state.cast = null;
      state.message = 'The bait drifted away without a bite.';
    }
  }
}

function updateRipples(dt) {
  state.world.ripples = state.world.ripples
    .map((ripple) => ({ ...ripple, life: ripple.life + dt * 1.1 }))
    .filter((ripple) => ripple.life < ripple.max);
}

function updateFish(dt) {
  for (const fish of state.world.fish) {
    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;
    fish.bob += dt * 2.2;

    if (fish.x < 40 || fish.x > canvas.width - 40) fish.vx *= -1;
    if (fish.y < 70 || fish.y > canvas.height - 60) fish.vy *= -1;
    fish.x = clamp(fish.x, 40, canvas.width - 40);
    fish.y = clamp(fish.y, 70, canvas.height - 60);
  }
}

function updateClouds(dt) {
  for (const cloud of state.world.clouds) {
    cloud.x += cloud.drift * dt;
    if (cloud.x > canvas.width + 80) cloud.x = -80;
  }
}

function update(dt) {
  state.time += dt;
  updatePlayer(dt);
  updateFish(dt);
  updateClouds(dt);
  updateRipples(dt);

  if (state.mode === 'playing') {
    updateCast(dt);
    startReel(dt);
    if (Math.random() < 0.0035) {
      const fish = state.world.fish[Math.floor(Math.random() * state.world.fish.length)];
      if (fish) {
        state.world.splashes.push({ x: fish.x, y: fish.y + 10, radius: 10, life: 0, max: 28 });
      }
    }
  }

  state.world.splashes = state.world.splashes
    .map((splash) => ({ ...splash, life: splash.life + dt * 2.2 }))
    .filter((splash) => splash.life < splash.max);

  if (state.activeCatch) {
    state.activeCatch.meter = 0.5 + Math.sin(state.time * 2.15) * 0.29;
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#091b2b');
  sky.addColorStop(0.5, '#123a4a');
  sky.addColorStop(1, '#0a2f3d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const cloud of state.world.clouds) {
    ctx.fillStyle = `rgba(255,255,255,${cloud.alpha})`;
    ctx.beginPath();
    ctx.arc(cloud.x - cloud.r * 0.7, cloud.y, cloud.r * 0.7, 0, Math.PI * 2);
    ctx.arc(cloud.x, cloud.y - 10, cloud.r * 0.8, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.8, cloud.y, cloud.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(10, 29, 35, 0.8)';
  ctx.fillRect(0, canvas.height - 70, canvas.width, 70);
  ctx.fillStyle = '#173d4a';
  ctx.fillRect(0, canvas.height - 82, canvas.width, 12);

  for (let i = 0; i < 9; i += 1) {
    const phase = (i / 9) * Math.PI * 2 + state.time * 0.7;
    const waveY = canvas.height - 52 + Math.sin(phase) * 4;
    ctx.strokeStyle = 'rgba(146, 209, 235, 0.26)';
    ctx.beginPath();
    ctx.moveTo(i * 120, waveY);
    ctx.lineTo(i * 120 + 70, waveY + 10);
    ctx.stroke();
  }
}

function drawFishingLine() {
  if (!state.cast && !state.activeCatch) return;

  const x = state.player.x;
  const y = state.player.y;

  if (state.cast) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(state.cast.targetX, state.cast.targetY);
    ctx.strokeStyle = 'rgba(185, 221, 248, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (state.activeCatch) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(state.activeCatch.fish.x, state.activeCatch.fish.y);
    ctx.strokeStyle = 'rgba(255, 210, 126, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawFish() {
  for (const fish of state.world.fish) {
    const bob = Math.sin(fish.bob) * 4;
    const x = fish.x;
    const y = fish.y + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fish.vx < 0 ? -1 : 1, 1);
    ctx.fillStyle = fish.kind.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, fish.size, fish.size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fish.size * 0.8, 0);
    ctx.lineTo(fish.size * 1.8, fish.size * 0.3);
    ctx.lineTo(fish.size * 1.8, -fish.size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0d1a1e';
    ctx.fillRect(fish.size * 0.12, -2, 3, 3);
    ctx.restore();
  }
}

function drawRipples() {
  for (const ripple of state.world.ripples) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(148, 226, 255, ${1 - ripple.life / ripple.max})`;
    ctx.lineWidth = 2;
    ctx.arc(ripple.x, ripple.y, ripple.r + ripple.life * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const splash of state.world.splashes) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(150, 222, 255, ${1 - splash.life / splash.max})`;
    ctx.arc(splash.x, splash.y, splash.radius + splash.life * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer() {
  const { x, y } = state.player;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(state.player.tilt);

  ctx.fillStyle = '#f6c78b';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d9cdb';
  ctx.fillRect(-6, 16, 12, 22);
  ctx.fillStyle = '#1d3b52';
  ctx.fillRect(-12, 36, 6, 18);
  ctx.fillRect(6, 36, 6, 18);
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(16, 16, 280, 96);

  ctx.fillStyle = '#edf7ff';
  ctx.font = '700 18px sans-serif';
  ctx.fillText(`Day ${state.day}`, 32, 42);
  ctx.fillText(`Gold: ${state.gold}`, 32, 64);
  ctx.fillText(`Catch: ${state.fishCaughtToday}/${state.needForDay}`, 32, 86);

  const barX = 322;
  const barY = 20;
  ctx.fillStyle = 'rgba(148, 175, 190, 0.45)';
  ctx.fillRect(barX, barY, 180, 18);
  ctx.fillStyle = '#7ae7d1';
  ctx.fillRect(barX, barY, 180 * (state.energy / 100), 18);
  ctx.fillText('Energy', barX, 58);

  if (state.activeCatch) {
    const meterX = 320;
    const meterY = 80;
    const meterWidth = 220;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(meterX, meterY, meterWidth, 20);
    ctx.fillStyle = 'rgba(122, 231, 209, 0.62)';
    ctx.fillRect(meterX + meterWidth * state.activeCatch.min, meterY, meterWidth * (state.activeCatch.max - state.activeCatch.min), 20);
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(meterX + meterWidth * state.activeCatch.meter - 2, meterY - 3, 4, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(meterX, meterY + 27, meterWidth, 7);
    ctx.fillStyle = '#ffb870';
    ctx.fillRect(meterX, meterY + 27, meterWidth * state.activeCatch.progress, 7);
    ctx.fillStyle = '#edf7ff';
    ctx.fillText('Hold Space / click in green • release to wait', meterX, 116);
  }
}

function drawMessage() {
  ctx.fillStyle = 'rgba(10, 17, 25, 0.62)';
  ctx.fillRect(18, canvas.height - 52, canvas.width - 36, 28);
  ctx.fillStyle = '#edf7ff';
  ctx.font = '600 15px sans-serif';
  ctx.fillText(state.message, 30, canvas.height - 32);
}

function draw() {
  drawBackground();
  drawFish();
  drawRipples();
  drawFishingLine();
  drawPlayer();
  drawHud();
  drawMessage();
}

let last = performance.now();
function loop(ts) {
  const dt = Math.min((ts - last) / 1000, 0.033);
  last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

function handlePointerDown(event) {
  handlePointerMove(event);
  if (state.mode === 'playing') {
    if (!state.activeCatch) {
      castLine();
      pointer.down = true;
    } else {
      pointer.down = true;
    }
  }
}

function handlePointerUp() {
  pointer.down = false;
}

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointerleave', handlePointerUp);

touchButtons.forEach((button) => {
  const key = button.dataset.key;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    keys[key] = true;
  });
  const release = () => { keys[key] = false; };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

touchCast.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  touchCast.setPointerCapture(event.pointerId);
  if (state.mode === 'playing') {
    if (!state.activeCatch) castLine();
    pointer.down = true;
  }
});
touchCast.addEventListener('pointerup', handlePointerUp);
touchCast.addEventListener('pointercancel', handlePointerUp);
touchCast.addEventListener('lostpointercapture', handlePointerUp);

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = true;
  if (key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (state.mode === 'playing') {
      castLine();
    }
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys[key] = false;
  if (key === ' ' || event.key === 'Spacebar') {
    pointer.down = false;
  }
});

startBtn.addEventListener('click', beginRun);
nextDayBtn.addEventListener('click', nextDay);
upgradeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    buyUpgrade(button.dataset.upgrade);
  });
});

resetWorld();
requestAnimationFrame(loop);
