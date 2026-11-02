const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const actionButton = document.getElementById('action-button');
const buttonLabel = document.getElementById('button-label');
const buttonIcon = document.getElementById('button-icon');
const statusCopy = document.getElementById('status-copy');
const hint = document.getElementById('hint');
const sceneNote = document.getElementById('scene-note');
const toast = document.getElementById('toast');
const fishList = document.getElementById('fish-list');

// Time of day modes
const TIMES_OF_DAY = [
  { id: 'morning', label: 'MORNING TIDE', icon: '☀', weather: '24°<small> · gentle breeze</small>' },
  { id: 'sunset',  label: 'GOLDEN HOUR',  icon: '🌅', weather: '21°<small> · amber calm</small>' },
  { id: 'night',   label: 'STARRY DUSK',  icon: '🌙', weather: '18°<small> · quiet starlight</small>' }
];
let timeIdx = 0;

// Fishes with rarity, size range, lore
const fishes = [
  {
    id: 'sunfin',
    name: 'Sunfin',
    emoji: '🐠',
    rarity: 'Common',
    sizeRange: [12, 18],
    color: '#f5ad69',
    note: 'A little sunfin! It practically glows in the sunlight.',
    desc: 'Loves sun-warmed shallows and friendly chatter. Its fins catch the morning glow like amber glass.'
  },
  {
    id: 'bluegill',
    name: 'Bluegill',
    emoji: '🐟',
    rarity: 'Common',
    sizeRange: [15, 24],
    color: '#84aeb4',
    note: 'A bluegill, cool as the morning tide.',
    desc: 'Dwells in quiet shade beside the wooden dock pilings. Very inquisitive, especially near noon.'
  },
  {
    id: 'moon-koi',
    name: 'Moon Koi',
    emoji: '🐡',
    rarity: 'Uncommon',
    sizeRange: [22, 35],
    color: '#e5ae9c',
    note: 'A moon koi! What a lovely surprise.',
    desc: 'A calm, serene swimmer with porcelain scales that shimmer like evening lantern light.'
  },
  {
    id: 'sea-star',
    name: 'Sea Star',
    emoji: '⭐',
    rarity: 'Uncommon',
    sizeRange: [8, 14],
    color: '#efb771',
    note: 'A tiny sea star came to say hello.',
    desc: 'Gently clings to sandy pebbles and kelp roots. Brings good tidings to patient anglers.'
  },
  {
    id: 'pufflet',
    name: 'Pufflet',
    emoji: '🐡',
    rarity: 'Rare',
    sizeRange: [10, 16],
    color: '#d8b695',
    note: 'A pufflet with the sweetest little face.',
    desc: 'Puffs into a round little cloud whenever startled, but relaxes quickly with calm company.'
  },
  {
    id: 'silverling',
    name: 'Silverling',
    emoji: '🐟',
    rarity: 'Legendary',
    sizeRange: [28, 42],
    color: '#a8bdad',
    note: 'A silverling, shimmering in the light!',
    desc: 'Rarely seen in broad daylight. Rumored to mirror the constellation above Pebble Cove.'
  }
];

const counts = Array(fishes.length).fill(0);
const bestSizes = Array(fishes.length).fill(0);
let caught = 0;
let phase = 'idle'; // 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling'
let biteAt = 0;
let castStart = 0;
let bobber = { x: 690, y: 430, targetX: 690, targetY: 430, startX: 413, startY: 449 };
let toastTimer;
let startedAt = performance.now();
let ripples = [];
let particles = [];
let ambientFish = [];

// Audio
let audioContext = null;
let ambience = null;
let soundOn = false;

// Initialize ambient fish shadows
for (let i = 0; i < 4; i++) {
  ambientFish.push({
    x: 480 + Math.random() * 450,
    y: 350 + Math.random() * 200,
    speed: 0.25 + Math.random() * 0.35,
    dir: Math.random() > 0.5 ? 1 : -1,
    length: 18 + Math.random() * 16,
    depth: 0.15 + Math.random() * 0.25
  });
}

// Generate stars for night
const stars = [];
for (let i = 0; i < 45; i++) {
  stars.push({
    x: Math.random() * 1000,
    y: Math.random() * 240,
    size: 0.7 + Math.random() * 1.6,
    twinkle: Math.random() * Math.PI * 2
  });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const sx = canvas.width / 1000;
  const sy = canvas.height / 650;
  if (canvas.width / canvas.height < 1.35) {
    const scale = Math.max(sx, sy);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - 1000 * scale) / 2, 0);
  } else {
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
  }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function path(points, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function ellipse(x, y, rx, ry, fill, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function drawCloud(x, y, s, alpha, timeId) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = timeId === 'night' ? '#687e91' : timeId === 'sunset' ? '#fed3b1' : '#fffdf0';
  ellipse(x, y, 44*s, 16*s, ctx.fillStyle);
  ellipse(x-27*s, y+5*s, 25*s, 12*s, ctx.fillStyle);
  ellipse(x+24*s, y+6*s, 30*s, 12*s, ctx.fillStyle);
  ellipse(x-5*s, y-8*s, 26*s, 18*s, ctx.fillStyle);
  ctx.restore();
}

function drawTree(x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  path([[-5,4],[2,-31],[9,4]], '#8b7251');
  ellipse(-8,-26,14,17,color);
  ellipse(8,-33,17,20,color);
  ellipse(0,-46,14,16,color);
  ellipse(18,-21,12,15,color);
  ctx.restore();
}

function drawIsland(t, timeId) {
  // Faraway headland
  const headlandCol = timeId === 'night' ? '#264b58' : timeId === 'sunset' ? '#867272' : '#9dc7b6';
  path([[0,315],[0,268],[70,260],[118,247],[174,256],[222,248],[276,261],[335,266],[399,258],[463,269],[526,267],[579,276],[630,267],[688,271],[749,257],[808,264],[865,254],[930,263],[1000,251],[1000,380],[0,380]], headlandCol);

  // Island sand
  const sandCol = timeId === 'night' ? '#7b7971' : timeId === 'sunset' ? '#e5a56d' : '#e8c994';
  ellipse(755, 344, 259, 109, sandCol);

  // Island grass
  const grassCol = timeId === 'night' ? '#294e3e' : timeId === 'sunset' ? '#4d6c4a' : '#618e6d';
  ctx.beginPath();
  ctx.moveTo(506,362);
  ctx.bezierCurveTo(552,277,622,258,698,270);
  ctx.bezierCurveTo(784,230,880,258,943,300);
  ctx.bezierCurveTo(1001,332,1008,374,991,379);
  ctx.bezierCurveTo(966,388,946,372,920,380);
  ctx.bezierCurveTo(890,391,864,374,835,381);
  ctx.bezierCurveTo(804,390,780,374,751,381);
  ctx.bezierCurveTo(719,389,692,373,663,379);
  ctx.bezierCurveTo(625,385,588,379,556,372);
  ctx.closePath();
  ctx.fillStyle = grassCol;
  ctx.fill();

  // Ridge highlight
  ctx.beginPath();
  ctx.moveTo(564,329);
  ctx.bezierCurveTo(643,276,724,284,777,294);
  ctx.bezierCurveTo(842,282,899,301,946,326);
  ctx.strokeStyle = timeId === 'night' ? '#3d6854' : timeId === 'sunset' ? '#708657' : '#7fa878';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Trees
  const tree1 = timeId === 'night' ? '#1e3e30' : timeId === 'sunset' ? '#3b553e' : '#416e58';
  const tree2 = timeId === 'night' ? '#244535' : timeId === 'sunset' ? '#415d43' : '#49775c';
  drawTree(664,310,.75, tree1);
  drawTree(713,291,1.05, tree2);
  drawTree(764,302,.86, tree1);
  drawTree(824,291,1.15, tree2);
  drawTree(877,310,.79, tree1);
  drawTree(936,317,.58, tree2);

  // Tiny cottage
  const wallCol = timeId === 'night' ? '#928475' : timeId === 'sunset' ? '#f0c497' : '#f3d9ae';
  const roofCol = timeId === 'night' ? '#68453e' : timeId === 'sunset' ? '#a45741' : '#bd8063';
  roundRect(742,310,48,30,3, wallCol);
  path([[735,311],[766,287],[797,311]], roofCol);
  roundRect(758,319,11,21,2, timeId === 'night' ? '#4b5545' : '#8e9b78');
  // Window: glows warm yellow at night/sunset
  const winGlow = timeId === 'night' ? '#ffe078' : timeId === 'sunset' ? '#ffd885' : '#a9c5b0';
  roundRect(775,317,9,9,2, winGlow);
  if (timeId === 'night') {
    ctx.save();
    ctx.shadowColor = '#ffd358';
    ctx.shadowBlur = 10;
    roundRect(775,317,9,9,2, '#fff1a8');
    ctx.restore();
  }
}

function drawDock(t, timeId) {
  const shadowCol = timeId === 'night' ? '#1f383e' : timeId === 'sunset' ? '#474c4d' : '#55776a';
  const postCol = timeId === 'night' ? '#634937' : timeId === 'sunset' ? '#8a5c37' : '#a9784b';
  const deckCol = timeId === 'night' ? '#74573f' : timeId === 'sunset' ? '#aa7445' : '#c99560';

  path([[100,515],[479,518],[540,650],[72,650]], shadowCol);
  for (const x of [142,219,296,373,450]) {
    path([[x,490],[x+13,491],[x+20,627],[x+6,627]], postCol);
  }
  path([[94,468],[472,468],[536,555],[42,555]], deckCol);
  path([[94,468],[472,468],[536,555],[42,555]], null, '#8e623b', 2.5);

  for (let i = 1; i < 7; i++) {
    const yy = 468 + i * 12.2;
    const lx = 94 - (52/87)*(yy - 468);
    const rx = 472 + (64/87)*(yy - 468);
    ctx.beginPath();
    ctx.moveTo(lx, yy);
    ctx.lineTo(rx, yy);
    ctx.strokeStyle = i % 2 ? '#9f6f43' : '#b98756';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Bollards
  roundRect(88,464,12,20,4, postCol);
  roundRect(463,464,12,20,4, postCol);
  ctx.beginPath(); ctx.ellipse(135,488,12,4,.1,0,Math.PI*2); ctx.strokeStyle='#d5bc8c'; ctx.lineWidth=2; ctx.stroke();

  // Fishing basket & small lantern
  roundRect(128,519,48,29,6, timeId === 'night' ? '#475e53' : '#789580');
  ctx.beginPath(); ctx.moveTo(127,529); ctx.quadraticCurveTo(151,539,177,529); ctx.strokeStyle='#a5bba0'; ctx.lineWidth=2; ctx.stroke();

  // Dock lantern
  const lx = 442, ly = 465;
  roundRect(lx, ly, 14, 18, 3, '#333');
  roundRect(lx+2, ly+3, 10, 12, 2, timeId === 'night' ? '#ffdf7a' : timeId === 'sunset' ? '#fed384' : '#fff4cf');
  if (timeId === 'night') {
    ctx.save();
    ctx.shadowColor = '#ffc83b';
    ctx.shadowBlur = 18;
    roundRect(lx+3, ly+4, 8, 10, 2, '#fff7c2');
    ctx.restore();
  }
}

function drawFisher(t, timeId) {
  // Sitting shadow
  ellipse(370,488,35,7,'#1a332c33');

  // Legs & boots
  path([[381,461],[398,478],[414,484],[408,491],[389,485],[369,470]], timeId==='night'?'#283d34':'#455e50');
  path([[402,479],[416,485],[421,491],[407,493],[396,486]], '#5c412f');

  // Sweater
  const sweaterCol = timeId === 'night' ? '#924d31' : '#d27c54';
  ctx.beginPath();
  ctx.moveTo(348,425);
  ctx.quadraticCurveTo(365,412,382,429);
  ctx.lineTo(390,463);
  ctx.quadraticCurveTo(369,477,344,459);
  ctx.closePath();
  ctx.fillStyle = sweaterCol;
  ctx.fill();

  // Face
  roundRect(359,414,13,16,5,'#d7a27b');
  ellipse(361,410,15,15,'#e5b68f');

  // Cap
  const capCol = timeId === 'night' ? '#b6883f' : '#e8b965';
  ctx.beginPath(); ctx.ellipse(360,399,19,10,-.1,Math.PI,Math.PI*2); ctx.fillStyle = capCol; ctx.fill();
  ctx.beginPath(); ctx.ellipse(367,401,21,3,.1,0,Math.PI*2); ctx.fillStyle = '#b07f35'; ctx.fill();

  // Arm & rod dynamics
  let rodBend = 0;
  if (phase === 'casting') {
    const p = Math.min((performance.now() - castStart) / 500, 1);
    rodBend = Math.sin(p * Math.PI) * 16;
  } else if (phase === 'bite') {
    rodBend = Math.sin(t * 12) * 5 + 6;
  }

  // Arm
  ctx.beginPath();
  ctx.moveTo(373,431);
  ctx.quadraticCurveTo(389,426 - rodBend * 0.3, 405, 441 - rodBend * 0.3);
  ctx.lineTo(420,448 - rodBend * 0.2);
  ctx.lineTo(415,455);
  ctx.quadraticCurveTo(398,451,382,446);
  ctx.closePath();
  ctx.fillStyle = sweaterCol;
  ctx.fill();

  // Fishing rod
  const tipX = 548;
  const tipY = 373 + rodBend;
  ctx.beginPath();
  ctx.moveTo(413, 449);
  ctx.quadraticCurveTo(474, 382 + rodBend * 0.8, tipX, tipY);
  ctx.strokeStyle = '#6b4f35';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fishing line
  if (phase !== 'idle') {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    const sag = phase === 'bite' ? 4 : 28 + Math.sin(t * 2) * 4;
    const midX = (tipX + bobber.x) / 2;
    const midY = Math.min(tipY, bobber.y) + sag;
    ctx.quadraticCurveTo(midX, midY, bobber.x, bobber.y - 4);
    ctx.strokeStyle = timeId === 'night' ? 'rgba(255,255,255,0.45)' : 'rgba(251,246,223,0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Scarf
  ctx.beginPath();
  ctx.moveTo(351,430);
  ctx.quadraticCurveTo(365,437,379,429);
  ctx.lineTo(375,438);
  ctx.quadraticCurveTo(364,444,350,437);
  ctx.closePath();
  ctx.fillStyle = timeId === 'night' ? '#c4a663' : '#f0d18a';
  ctx.fill();
}

function drawWater(t, timeId) {
  const water = ctx.createLinearGradient(0, 272, 0, 650);
  if (timeId === 'night') {
    water.addColorStop(0, '#1d4857');
    water.addColorStop(0.5, '#173644');
    water.addColorStop(1, '#0e242f');
  } else if (timeId === 'sunset') {
    water.addColorStop(0, '#987573');
    water.addColorStop(0.48, '#6c6f7b');
    water.addColorStop(1, '#3b5860');
  } else {
    water.addColorStop(0, '#83bdba');
    water.addColorStop(0.52, '#63aaa9');
    water.addColorStop(1, '#438e92');
  }
  ctx.fillStyle = water;
  ctx.fillRect(0, 274, 1000, 376);

  // Watery horizon glow
  const glow = ctx.createRadialGradient(690, 320, 8, 690, 320, 390);
  if (timeId === 'night') {
    glow.addColorStop(0, 'rgba(84,136,163,0.22)');
    glow.addColorStop(1, 'rgba(84,136,163,0)');
  } else if (timeId === 'sunset') {
    glow.addColorStop(0, 'rgba(255,160,105,0.28)');
    glow.addColorStop(1, 'rgba(255,160,105,0)');
  } else {
    glow.addColorStop(0, 'rgba(214,229,187,0.33)');
    glow.addColorStop(1, 'rgba(214,229,187,0)');
  }
  ctx.fillStyle = glow;
  ctx.fillRect(300, 274, 700, 376);

  // Ambient swimming fish shadows in the cove
  for (const f of ambientFish) {
    f.x += f.speed * f.dir;
    if (f.x > 960) { f.dir = -1; f.y = 330 + Math.random() * 220; }
    if (f.x < 460) { f.dir = 1; f.y = 330 + Math.random() * 220; }
    const tailWiggle = Math.sin(t * 5 + f.x * 0.1) * 3;
    ctx.save();
    ctx.globalAlpha = f.depth * (timeId === 'night' ? 0.4 : 0.7);
    ctx.fillStyle = timeId === 'night' ? '#3e758a' : '#275253';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.length, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tiny tail fin
    ctx.beginPath();
    const tailX = f.dir === 1 ? f.x - f.length : f.x + f.length;
    ctx.moveTo(tailX, f.y);
    ctx.lineTo(tailX - f.dir * 6, f.y - 4 + tailWiggle);
    ctx.lineTo(tailX - f.dir * 6, f.y + 4 + tailWiggle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Wavelets
  const waveCol = timeId === 'night' ? 'rgba(180,225,245,0.08)' : timeId === 'sunset' ? 'rgba(255,225,185,0.14)' : 'rgba(244,247,218,0.12)';
  for (let i = 0; i < 30; i++) {
    const seed = i * 137.5;
    const x = ((seed + t * (5 + (i % 3) * 1.5)) % 1160) - 80;
    const y = 300 + (i * 47 % 345);
    const w = 12 + (i * 19 % 46);
    ctx.beginPath();
    ctx.ellipse(x, y, w, 1.5, 0, 0, Math.PI);
    ctx.strokeStyle = waveCol;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  // Shimmer trail
  const shimmerCol = timeId === 'night' ? 'rgba(220,240,255,0.07)' : timeId === 'sunset' ? 'rgba(255,200,140,0.15)' : 'rgba(255,244,197,0.11)';
  for (let i = 0; i < 14; i++) {
    const y = 319 + i * 13;
    const x = 647 + (i % 4) * 17 + Math.sin(t * 0.4 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 18 + (i % 3) * 10, y);
    ctx.strokeStyle = shimmerCol;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function addRipple(x, y, maxR = 26, maxAlpha = 0.5) {
  ripples.push({ x, y, r: 2, maxR, alpha: maxAlpha });
}

function updateAndDrawRipples() {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.r += 0.45;
    r.alpha *= 0.965;
    if (r.alpha < 0.02 || r.r >= r.maxR) {
      ripples.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 252, 230, ${r.alpha})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }
}

function addSparkle(x, y, color = '#ffd67a') {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 2.2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      alpha: 1,
      color,
      size: 2 + Math.random() * 2.5
    });
  }
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // soft gravity
    p.alpha -= 0.022;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBobber(t) {
  if (phase === 'idle') return;

  if (phase === 'casting') {
    const p = Math.min((performance.now() - castStart) / 600, 1);
    // Arc trajectory
    const currentX = bobber.startX + (bobber.targetX - bobber.startX) * p;
    const height = Math.sin(p * Math.PI) * 90;
    const currentY = bobber.startY + (bobber.targetY - bobber.startY) * p - height;
    bobber.x = currentX;
    bobber.y = currentY;

    if (p >= 1) {
      phase = 'waiting';
      addRipple(bobber.x, bobber.y, 35, 0.65);
      playSplash();
    }
  }

  const bobY = bobber.y + (phase === 'waiting' ? Math.sin(t * 2.7) * 2 : phase === 'bite' ? Math.sin(t * 14) * 4 + 3 : 0);

  if (phase === 'waiting' && Math.random() < 0.03) {
    addRipple(bobber.x, bobY, 16, 0.28);
  }

  if (phase === 'bite') {
    const pulse = (Math.sin(t * 9) + 1) / 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(bobber.x, bobY, 11 + i * 9 + pulse * 6, 3 + i * 2 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 245, 200, ${0.48 - i * 0.12})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ellipse(bobber.x, bobY, 5, 5, '#fff6d5');
  }

  // Float body
  ctx.beginPath();
  ctx.moveTo(bobber.x - 5, bobY - 10);
  ctx.lineTo(bobber.x + 5, bobY - 10);
  ctx.lineTo(bobber.x + 3, bobY + 2);
  ctx.quadraticCurveTo(bobber.x, bobY + 7, bobber.x - 3, bobY + 2);
  ctx.closePath();
  ctx.fillStyle = '#f3eee0';
  ctx.fill();

  // Red cap
  ctx.beginPath();
  ctx.moveTo(bobber.x - 4, bobY - 1);
  ctx.lineTo(bobber.x + 4, bobY - 1);
  ctx.lineTo(bobber.x + 3, bobY + 3);
  ctx.quadraticCurveTo(bobber.x, bobY + 6, bobber.x - 3, bobY + 3);
  ctx.closePath();
  ctx.fillStyle = '#dc8366';
  ctx.fill();
}

function drawScene(now) {
  const t = (now - startedAt) / 1000;
  const time = TIMES_OF_DAY[timeIdx];

  ctx.clearRect(0, 0, 1000, 650);

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, 350);
  if (time.id === 'night') {
    sky.addColorStop(0, '#0c1b2c');
    sky.addColorStop(0.55, '#19334a');
    sky.addColorStop(1, '#2c4b60');
  } else if (time.id === 'sunset') {
    sky.addColorStop(0, '#6d5a7d');
    sky.addColorStop(0.45, '#d67e69');
    sky.addColorStop(1, '#fed498');
  } else {
    sky.addColorStop(0, '#b9dcd3');
    sky.addColorStop(0.62, '#d3e6cf');
    sky.addColorStop(1, '#f1e7c8');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1000, 350);

  // Stars (Night only)
  if (time.id === 'night') {
    for (const star of stars) {
      const alpha = 0.4 + Math.sin(t * 2 + star.twinkle) * 0.35;
      ctx.fillStyle = `rgba(255, 255, 235, ${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Celestial Body (Sun or Moon)
  const sx = 724, sy = 115;
  if (time.id === 'night') {
    // Crescent / Pale moon
    const moonG = ctx.createRadialGradient(sx, sy, 4, sx, sy, 55);
    moonG.addColorStop(0, 'rgba(235, 245, 255, 0.8)');
    moonG.addColorStop(0.6, 'rgba(210, 230, 255, 0.25)');
    moonG.addColorStop(1, 'rgba(210, 230, 255, 0)');
    ctx.fillStyle = moonG;
    ctx.beginPath(); ctx.arc(sx, sy, 55, 0, Math.PI * 2); ctx.fill();
    ellipse(sx, sy, 22, 22, '#eff7ff');
    // subtle moon crater
    ellipse(sx - 4, sy - 3, 5, 4, '#d8e7f5');
    ellipse(sx + 5, sy + 4, 3, 3, '#d8e7f5');
  } else {
    // Sun
    const sunColor1 = time.id === 'sunset' ? '#ff9e5e' : '#fff8d5';
    const sunColor2 = time.id === 'sunset' ? '#f5744b' : '#f8e5ad';
    const sunG = ctx.createRadialGradient(sx, sy, 7, sx, sy, 63);
    sunG.addColorStop(0, sunColor1);
    sunG.addColorStop(0.72, sunColor2);
    sunG.addColorStop(1, 'rgba(248, 229, 173, 0)');
    ctx.fillStyle = sunG;
    ctx.beginPath(); ctx.arc(sx, sy, 64, 0, Math.PI * 2); ctx.fill();
    ellipse(sx, sy, 27, 27, time.id === 'sunset' ? '#ffe0a8' : '#fff4ce');
  }

  // Clouds
  drawCloud(161 + Math.sin(t * 0.035) * 14, 105, 1.05, 0.75, time.id);
  drawCloud(431 + Math.sin(t * 0.027) * 10, 155, 0.7, 0.47, time.id);
  drawCloud(889 + Math.sin(t * 0.03) * 8, 92, 0.68, 0.44, time.id);

  // Water & scenery
  drawWater(t, time.id);
  updateAndDrawRipples();
  drawIsland(t, time.id);
  drawBobber(t);
  drawDock(t, time.id);
  drawFisher(t, time.id);
  updateAndDrawParticles();

  // Foreground reeds
  const reedColor = time.id === 'night' ? '#253e34' : time.id === 'sunset' ? '#465b46' : '#527b5e';
  for (const [x, y, s] of [[17, 581, 1], [950, 594, 0.9], [985, 548, 0.62], [20, 540, 0.7]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const reedSway = Math.sin(t * 1.5 + x) * 2;
    ctx.strokeStyle = reedColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(8 + reedSway, 6, 3 + reedSway, -15);
    ctx.stroke();
    ellipse(-4 + reedSway * 0.5, 1, 7, 3, '#73966b', -0.5);
    ellipse(10 + reedSway * 0.7, -10, 8, 3, '#648d65', 0.5);
    ellipse(0 + reedSway, -21, 7, 3, '#83a574', -0.7);
    ctx.restore();
  }

  // Vignette
  const edge = ctx.createLinearGradient(0, 0, 1000, 0);
  const vignetteTint = time.id === 'night' ? '#08172428' : '#315d4e14';
  edge.addColorStop(0, vignetteTint);
  edge.addColorStop(0.12, 'transparent');
  edge.addColorStop(0.88, 'transparent');
  edge.addColorStop(1, vignetteTint);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 1000, 650);

  requestAnimationFrame(drawScene);
}
requestAnimationFrame(drawScene);

function cycleTimeOfDay() {
  timeIdx = (timeIdx + 1) % TIMES_OF_DAY.length;
  const time = TIMES_OF_DAY[timeIdx];
  document.getElementById('weather-icon').textContent = time.icon;
  document.getElementById('weather-text').innerHTML = time.weather;
  document.getElementById('time-badge').textContent = time.label;
  showToast(`Time turns to ${time.label.toLowerCase()}.`);
}

document.getElementById('time-toggle').addEventListener('click', cycleTimeOfDay);
document.getElementById('time-toggle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    cycleTimeOfDay();
  }
});

function setPhase(next) {
  phase = next;
  actionButton.classList.toggle('biting', next === 'bite');

  if (next === 'idle') {
    actionButton.disabled = false;
    buttonLabel.textContent = 'Cast your line';
    buttonIcon.textContent = '↗';
    statusCopy.textContent = caught ? 'A lovely little catch. The cove has more secrets.' : "The water looks lovely. Cast whenever you're ready.";
    hint.innerHTML = '<span class="hint-icon">✦</span><span>Listen for a little splash.</span>';
    sceneNote.textContent = 'The tide is in no hurry. Neither are you.';
  } else if (next === 'casting') {
    actionButton.disabled = true;
    buttonLabel.textContent = 'Casting...';
    buttonIcon.textContent = '◌';
    statusCopy.textContent = 'Gently casting toward the calm water...';
    hint.innerHTML = '<span class="hint-icon">◌</span><span>Watching your line fly...</span>';
    sceneNote.textContent = 'A quiet cast across the water.';
  } else if (next === 'waiting') {
    actionButton.disabled = false;
    buttonLabel.textContent = 'Bring in your line';
    buttonIcon.textContent = '↙';
    statusCopy.textContent = 'Your line is out. The little cove is full of possibilities.';
    hint.innerHTML = '<span class="hint-icon">◌</span><span>Take a breath. See what comes by.</span>';
    sceneNote.textContent = 'A tiny ripple dances in the sunlight.';
  } else if (next === 'bite') {
    actionButton.disabled = false;
    buttonLabel.textContent = 'Reel it in';
    buttonIcon.textContent = '✦';
    statusCopy.textContent = 'There it is — something curious found your line!';
    hint.innerHTML = '<span class="hint-icon">♫</span><span>A little friend is waiting!</span>';
    sceneNote.textContent = 'A small splash. Someone said hello!';
  }
}

function castLine() {
  if (phase === 'idle') {
    bobber.startX = 413;
    bobber.startY = 449;
    bobber.targetX = 660 + Math.random() * 140;
    bobber.targetY = 405 + Math.random() * 40;
    bobber.x = bobber.startX;
    bobber.y = bobber.startY;
    castStart = performance.now();
    setPhase('casting');
    biteAt = performance.now() + 3200 + Math.random() * 4800;
    playCastWhoosh();
    return;
  }

  if (phase === 'waiting') {
    setPhase('idle');
    showToast('Line tucked away. Cast again whenever you like.');
    return;
  }

  if (phase === 'bite') {
    const fishIndex = chooseFish();
    counts[fishIndex]++;
    caught++;

    const fish = fishes[fishIndex];
    const size = +(fish.sizeRange[0] + Math.random() * (fish.sizeRange[1] - fish.sizeRange[0])).toFixed(1);
    if (size > bestSizes[fishIndex]) bestSizes[fishIndex] = size;

    addSparkle(bobber.x, bobber.y, fish.color);
    updateCollection();
    setPhase('idle');
    playCatchFanfare();

    // Show catch dialog showcase
    openCatchDialog(fish, size);
  }
}

function openCatchDialog(fish, size) {
  const dialog = document.getElementById('catch-dialog');
  document.getElementById('catch-avatar').textContent = fish.emoji;
  document.getElementById('catch-name').textContent = fish.name;
  document.getElementById('catch-eyebrow').textContent = counts[fishes.indexOf(fish)] === 1 ? '✨ A new discovery!' : '🎣 Caught again!';
  document.getElementById('catch-meta').innerHTML = `<span>Length: <b>${size} cm</b></span><span>Rarity: <b>${fish.rarity}</b></span>`;
  document.getElementById('catch-desc').textContent = fish.desc;
  dialog.showModal();
}

document.getElementById('catch-done').addEventListener('click', () => {
  document.getElementById('catch-dialog').close();
});

function chooseFish() {
  const weighted = [];
  fishes.forEach((fish, i) => {
    // Rarer fish have slightly lower weight, but uncollected fish receive an exploration boost
    let w = fish.rarity === 'Legendary' ? 1 : fish.rarity === 'Rare' ? 2 : fish.rarity === 'Uncommon' ? 3 : 5;
    if (counts[i] === 0) w += 3; // encourage full collection
    for (let n = 0; n < w; n++) weighted.push(i);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

function updateCollection() {
  document.getElementById('fish-count').textContent = caught;
  const uniqueCount = counts.filter(n => n > 0).length;
  document.getElementById('species-count').textContent = uniqueCount;
  document.getElementById('collection-progress').textContent =
    uniqueCount === 6 ? 'The whole cove is your friend 🎉' :
    uniqueCount === 0 ? 'A collection in the making' :
    `${uniqueCount} little ${uniqueCount === 1 ? 'friend' : 'friends'} so far`;

  fishList.innerHTML = '';
  fishes.forEach((fish, i) => {
    if (counts[i]) {
      const chip = document.createElement('div');
      chip.className = 'fish-chip';
      chip.title = `${fish.name}: caught ${counts[i]} ${counts[i] === 1 ? 'time' : 'times'} (best: ${bestSizes[i]} cm)`;
      chip.innerHTML = `<span class="fish-emoji">${fish.emoji}</span><span>${fish.name}</span><span class="fish-total">×${counts[i]}</span>`;
      chip.addEventListener('click', () => openJournal());
      fishList.appendChild(chip);
    }
  });

  if (!uniqueCount) {
    fishList.innerHTML = '<div class="fish-placeholder"><span>✧</span> Your first friend is out there somewhere…</div>';
  }

  renderJournalGrid();
}

function renderJournalGrid() {
  const grid = document.getElementById('journal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  fishes.forEach((fish, i) => {
    const isCaught = counts[i] > 0;
    const card = document.createElement('div');
    card.className = `journal-card ${isCaught ? '' : 'locked'}`;
    card.innerHTML = `
      <div class="journal-icon">${isCaught ? fish.emoji : '❓'}</div>
      <div class="journal-info">
        <div class="journal-name">
          <span>${isCaught ? fish.name : 'Unknown Friend'}</span>
          <span class="journal-rarity">${fish.rarity}</span>
        </div>
        <div class="journal-desc">${isCaught ? fish.desc : 'Keep casting in Pebble Cove to meet this curious swimmer.'}</div>
        ${isCaught ? `<div class="journal-count">Caught: <b>${counts[i]}</b> · Best: <b>${bestSizes[i]} cm</b></div>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

function openJournal() {
  renderJournalGrid();
  document.getElementById('journal-dialog').showModal();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3100);
}

actionButton.addEventListener('click', castLine);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.repeat && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    castLine();
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  }
});

// Dialogs
const helpDialog = document.getElementById('help-dialog');
const journalDialog = document.getElementById('journal-dialog');
document.getElementById('help-button').addEventListener('click', () => helpDialog.showModal());
document.getElementById('close-help').addEventListener('click', () => helpDialog.close());
document.getElementById('help-done').addEventListener('click', () => helpDialog.close());
document.getElementById('journal-button').addEventListener('click', openJournal);
document.getElementById('close-journal').addEventListener('click', () => journalDialog.close());
document.getElementById('journal-done').addEventListener('click', () => journalDialog.close());

[helpDialog, journalDialog, document.getElementById('catch-dialog')].forEach(dlg => {
  dlg.addEventListener('click', e => {
    if (e.target === dlg) dlg.close();
  });
});

// Audio WebAudio API
function setupAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    // Gentle pink/brown noise for ocean tide
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = (Math.random() * 2 - 1) * 0.16;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.5;
    }
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(audioContext.destination);
    source.start();
    ambience = { gain, filter };
  }
  audioContext.resume();
}

function toggleSound() {
  if (!audioContext) setupAudio();
  soundOn = !soundOn;
  ambience.gain.gain.cancelScheduledValues(audioContext.currentTime);
  ambience.gain.gain.setTargetAtTime(soundOn ? 0.03 : 0, audioContext.currentTime, 0.5);
  document.getElementById('sound-icon').textContent = soundOn ? '♫' : '♪';
  const button = document.getElementById('sound-toggle');
  button.setAttribute('aria-label', soundOn ? 'Turn ambient sounds off' : 'Turn ambient sounds on');
  showToast(soundOn ? 'Soft island breeze & waves enabled.' : 'Quiet mode. Just peaceful silence.');
}

function playSplash() {
  if (!soundOn || !audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.18);
  gain.gain.setValueAtTime(0.04, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.22);
}

function playCastWhoosh() {
  if (!soundOn || !audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(360, audioContext.currentTime + 0.15);
  osc.frequency.exponentialRampToValueAtTime(140, audioContext.currentTime + 0.35);
  gain.gain.setValueAtTime(0.02, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);
  osc.connect(gain).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + 0.36);
}

function playChime() {
  if (!soundOn || !audioContext) return;
  [659.25, 783.99, 987.77].forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.07, audioContext.currentTime + i * 0.1 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + i * 0.1 + 0.6);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(audioContext.currentTime + i * 0.1);
    osc.stop(audioContext.currentTime + i * 0.1 + 0.62);
  });
}

function playCatchFanfare() {
  if (!soundOn || !audioContext) return;
  [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + i * 0.08 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + i * 0.08 + 0.8);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(audioContext.currentTime + i * 0.08);
    osc.stop(audioContext.currentTime + i * 0.08 + 0.85);
  });
}

document.getElementById('sound-toggle').addEventListener('click', toggleSound);

// Bite ticker
setInterval(() => {
  if (phase === 'waiting' && performance.now() >= biteAt) {
    setPhase('bite');
    if (soundOn) playChime();
    addRipple(bobber.x, bobber.y, 40, 0.8);
  }
}, 180);

updateCollection();
