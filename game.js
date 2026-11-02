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
const fishes = [
  { name: 'Sunfin', emoji: '🐠', color: '#f5ad69', note: 'A little sunfin! It practically glows.' },
  { name: 'Bluegill', emoji: '🐟', color: '#84aeb4', note: 'A bluegill, cool as the morning tide.' },
  { name: 'Moon Koi', emoji: '🐡', color: '#e5ae9c', note: 'A moon koi! What a lovely surprise.' },
  { name: 'Sea Star', emoji: '⭐', color: '#efb771', note: 'A tiny sea star came to say hello.' },
  { name: 'Pufflet', emoji: '🐡', color: '#d8b695', note: 'A pufflet with the sweetest little face.' },
  { name: 'Silverling', emoji: '🐟', color: '#a8bdad', note: 'A silverling, shimmering in the light.' }
];
const counts = Array(fishes.length).fill(0);
let caught = 0;
let phase = 'idle';
let biteAt = 0;
let bobber = { x: 690, y: 430 };
let toastTimer;
let startedAt = performance.now();
let audioContext = null;
let ambience = null;
let soundOn = false;
let lastFrame = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const sx = canvas.width / 1000;
  const sy = canvas.height / 650;
  if (canvas.width / canvas.height < 1.3) {
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
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function roundRect(x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}
function drawCloud(x, y, s, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fffdf0';
  ellipse(x, y, 44*s, 16*s, ctx.fillStyle); ellipse(x-27*s, y+5*s, 25*s, 12*s, ctx.fillStyle); ellipse(x+24*s, y+6*s, 30*s, 12*s, ctx.fillStyle); ellipse(x-5*s, y-8*s, 26*s, 18*s, ctx.fillStyle);
  ctx.restore();
}
function drawTree(x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  path([[-5,4],[2,-31],[9,4]], '#8b7251');
  ellipse(-8,-26,14,17,color); ellipse(8,-33,17,20,color); ellipse(0,-46,14,16,color); ellipse(18,-21,12,15,color);
  ctx.restore();
}
function drawIsland(t) {
  // Faraway, hazy headland
  path([[0,315],[0,268],[70,260],[118,247],[174,256],[222,248],[276,261],[335,266],[399,258],[463,269],[526,267],[579,276],[630,267],[688,271],[749,257],[808,264],[865,254],[930,263],[1000,251],[1000,380],[0,380]], '#9dc7b6');
  // Little island and sandy rim
  ellipse(755,344,259,109,'#e8c994');
  ctx.beginPath(); ctx.moveTo(506,362); ctx.bezierCurveTo(552,277,622,258,698,270); ctx.bezierCurveTo(784,230,880,258,943,300); ctx.bezierCurveTo(1001,332,1008,374,991,379); ctx.bezierCurveTo(966,388,946,372,920,380); ctx.bezierCurveTo(890,391,864,374,835,381); ctx.bezierCurveTo(804,390,780,374,751,381); ctx.bezierCurveTo(719,389,692,373,663,379); ctx.bezierCurveTo(625,385,588,379,556,372); ctx.closePath(); ctx.fillStyle='#618e6d'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(564,329); ctx.bezierCurveTo(643,276,724,284,777,294); ctx.bezierCurveTo(842,282,899,301,946,326); ctx.strokeStyle='#7fa878'; ctx.lineWidth=7; ctx.lineCap='round'; ctx.stroke();
  drawTree(664,310,.75,'#416e58'); drawTree(713,291,1.05,'#49775c'); drawTree(764,302,.86,'#527f61'); drawTree(824,291,1.15,'#426e56'); drawTree(877,310,.79,'#578265'); drawTree(936,317,.58,'#477459');
  // Tiny cottage tucked in the palms
  roundRect(742,310,48,30,3,'#f3d9ae');
  path([[735,311],[766,287],[797,311]],'#bd8063');
  roundRect(758,319,11,21,2,'#8e9b78'); roundRect(775,317,9,9,2,'#a9c5b0');
  // little beach flecks
  ellipse(596,355,2,1,'#c7a773'); ellipse(614,361,3,1,'#c7a773'); ellipse(911,349,2,1,'#c7a773');
}
function drawDock(t) {
  // Pier shadow and supports
  path([[100,515],[479,518],[540,650],[72,650]], '#55776a');
  for (const x of [142,219,296,373,450]) {
    path([[x,490],[x+13,491],[x+20,627],[x+6,627]], '#a9784b');
  }
  // Deck planks
  path([[94,468],[472,468],[536,555],[42,555]], '#c99560');
  path([[94,468],[472,468],[536,555],[42,555]], null, '#b27d4f', 3);
  for (let i=1;i<7;i++) {
    const yy=468+i*12.2; const lx=94-(52/87)*(yy-468); const rx=472+(64/87)*(yy-468);
    ctx.beginPath();ctx.moveTo(lx,yy);ctx.lineTo(rx,yy);ctx.strokeStyle=i%2?'#b98253':'#d7aa73';ctx.lineWidth=1.5;ctx.stroke();
  }
  // End bollards and little coil of rope
  roundRect(88,464,12,20,4,'#a8754d'); roundRect(463,464,12,20,4,'#a8754d');
  ctx.beginPath();ctx.ellipse(135,488,12,4,.1,0,Math.PI*2);ctx.strokeStyle='#e7cf9f';ctx.lineWidth=2;ctx.stroke();
  // A soft mint fishing basket
  roundRect(128,519,48,29,6,'#789580');
  ctx.beginPath();ctx.moveTo(127,529);ctx.quadraticCurveTo(151,539,177,529);ctx.strokeStyle='#a5bba0';ctx.lineWidth=2;ctx.stroke();
}
function drawFisher(t) {
  // Tiny seated island visitor, in a warm mustard hat
  ellipse(370,488,35,7,'#31564c2a');
  // legs and boots
  path([[381,461],[398,478],[414,484],[408,491],[389,485],[369,470]],'#455e50');
  path([[402,479],[416,485],[421,491],[407,493],[396,486]],'#73533e');
  // sweater and back
  ctx.beginPath();ctx.moveTo(348,425);ctx.quadraticCurveTo(365,412,382,429);ctx.lineTo(390,463);ctx.quadraticCurveTo(369,477,344,459);ctx.closePath();ctx.fillStyle='#d27c54';ctx.fill();
  // neck and face
  roundRect(359,414,13,16,5,'#d7a27b'); ellipse(361,410,15,15,'#e5b68f');
  // cap
  ctx.beginPath();ctx.ellipse(360,399,19,10,-.1,Math.PI,Math.PI*2);ctx.fillStyle='#e8b965';ctx.fill();
  ctx.beginPath();ctx.ellipse(367,401,21,3,.1,0,Math.PI*2);ctx.fillStyle='#cf9d54';ctx.fill();
  // arm reaching toward the rod
  ctx.beginPath();ctx.moveTo(373,431);ctx.quadraticCurveTo(389,426,405,441);ctx.lineTo(420,448);ctx.lineTo(415,455);ctx.quadraticCurveTo(398,451,382,446);ctx.closePath();ctx.fillStyle='#d27c54';ctx.fill();
  // rod and line
  ctx.beginPath();ctx.moveTo(413,449);ctx.quadraticCurveTo(474,382,548,373);ctx.strokeStyle='#77583d';ctx.lineWidth=4;ctx.lineCap='round';ctx.stroke();
  ctx.beginPath();ctx.moveTo(548,373);ctx.quadraticCurveTo(600,411,bobber.x,bobber.y-4);ctx.strokeStyle='#fbf6dfaa';ctx.lineWidth=1;ctx.stroke();
  // little seated scarf
  ctx.beginPath();ctx.moveTo(351,430);ctx.quadraticCurveTo(365,437,379,429);ctx.lineTo(375,438);ctx.quadraticCurveTo(364,444,350,437);ctx.closePath();ctx.fillStyle='#f0d18a';ctx.fill();
}
function drawWater(t) {
  const water = ctx.createLinearGradient(0,272,0,650);
  water.addColorStop(0,'#83bdba'); water.addColorStop(.52,'#63aaa9'); water.addColorStop(1,'#438e92');
  ctx.fillStyle=water;ctx.fillRect(0,274,1000,376);
  // watery glow below the horizon
  const glow=ctx.createRadialGradient(690,320,8,690,320,390);glow.addColorStop(0,'#d6e5bb55');glow.addColorStop(1,'#e7e5b500');ctx.fillStyle=glow;ctx.fillRect(300,274,700,376);
  // long, lazy little wave marks
  for(let i=0;i<34;i++) {
    const seed=i*137.5; const x=((seed + t*(5+(i%3)*1.5))%1160)-80; const y=300+(i*47%345);
    const w=12+(i*19%46); const alpha=.10+(i%4)*.025;
    ctx.beginPath();ctx.ellipse(x,y,w,1.6,0,0,Math.PI);ctx.strokeStyle=`rgba(244,247,218,${alpha})`;ctx.lineWidth=1.4;ctx.stroke();
  }
  // shimmering sunlight trail
  for(let i=0;i<13;i++) { const y=319+i*13; const x=647+(i%4)*17+Math.sin(t*.4+i)*8; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+17+(i%3)*10,y);ctx.strokeStyle=`rgba(255,244,197,${.11-i*.005})`;ctx.lineWidth=2;ctx.stroke(); }
}
function drawBobber(t) {
  if(phase==='idle') return;
  const bobY=bobber.y+Math.sin(t*2.7)*2;
  if(phase==='bite') {
    const pulse=(Math.sin(t*8)+1)/2;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(bobber.x,bobY,11+i*9+pulse*5,3+i*2+pulse*2,0,0,Math.PI*2);ctx.strokeStyle=`rgba(255,245,200,${.48-i*.12})`;ctx.lineWidth=1.6;ctx.stroke();}
    ellipse(bobber.x,bobY,5,5,'#fff6d5');
  }
  // float
  ctx.beginPath();ctx.moveTo(bobber.x-5,bobY-10);ctx.lineTo(bobber.x+5,bobY-10);ctx.lineTo(bobber.x+3,bobY+2);ctx.quadraticCurveTo(bobber.x,bobY+7,bobber.x-3,bobber.y+2);ctx.closePath();ctx.fillStyle='#f3eee0';ctx.fill();
  ctx.beginPath();ctx.moveTo(bobber.x-4,bobY-1);ctx.lineTo(bobber.x+4,bobY-1);ctx.lineTo(bobber.x+3,bobY+3);ctx.quadraticCurveTo(bobber.x,bobY+6,bobber.x-3,bobY+3);ctx.closePath();ctx.fillStyle='#dc8366';ctx.fill();
}
function drawScene(now) {
  const t=(now-startedAt)/1000;
  ctx.clearRect(0,0,1000,650);
  const sky=ctx.createLinearGradient(0,0,0,350);sky.addColorStop(0,'#b9dcd3');sky.addColorStop(.62,'#d3e6cf');sky.addColorStop(1,'#f1e7c8');ctx.fillStyle=sky;ctx.fillRect(0,0,1000,350);
  // sun
  const sx=724,sy=115;const sunG=ctx.createRadialGradient(sx,sy,7,sx,sy,63);sunG.addColorStop(0,'#fff8d5');sunG.addColorStop(.72,'#f8e5ad');sunG.addColorStop(1,'#f8e5ad00');ctx.fillStyle=sunG;ctx.beginPath();ctx.arc(sx,sy,64,0,Math.PI*2);ctx.fill();ellipse(sx,sy,27,27,'#fff4ce');
  drawCloud(161+Math.sin(t*.035)*14,105,1.05,.75);drawCloud(431+Math.sin(t*.027)*10,155,.7,.47);drawCloud(889+Math.sin(t*.03)*8,92,.68,.44);
  drawWater(t);drawIsland(t);drawBobber(t);drawDock(t);drawFisher(t);
  // Foreground sprigs framing the cove
  for(const [x,y,s] of [[17,581,1],[950,594,.9],[985,548,.62],[20,540,.7]]) {
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle='#527b5e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,30);ctx.quadraticCurveTo(8,6,3,-15);ctx.stroke();ellipse(-4,1,7,3,'#73966b',-.5);ellipse(10,-10,8,3,'#648d65',.5);ellipse(0,-21,7,3,'#83a574',-.7);ctx.restore();
  }
  // vignette just at edges for a storybook frame
  const edge=ctx.createLinearGradient(0,0,1000,0);edge.addColorStop(0,'#315d4e14');edge.addColorStop(.12,'transparent');edge.addColorStop(.88,'transparent');edge.addColorStop(1,'#315d4e14');ctx.fillStyle=edge;ctx.fillRect(0,0,1000,650);
  requestAnimationFrame(drawScene);
}
requestAnimationFrame(drawScene);

function setPhase(next) {
  phase=next;
  actionButton.classList.toggle('biting',next==='bite');
  if(next==='idle') {
    actionButton.disabled=false; buttonLabel.textContent='Cast your line';buttonIcon.textContent='↗';
    statusCopy.textContent=caught ? 'A lovely little catch. The cove has more secrets.' : "The water looks lovely. Cast whenever you're ready.";
    hint.innerHTML='<span class="hint-icon">✦</span><span>Listen for a little splash.</span>';
    sceneNote.textContent='The tide is in no hurry. Neither are you.';
  } else if(next==='waiting') {
    actionButton.disabled=false; buttonLabel.textContent='Bring in your line';buttonIcon.textContent='↙';
    statusCopy.textContent='Your line is out. The little cove is full of possibilities.';
    hint.innerHTML='<span class="hint-icon">◌</span><span>Take a breath. See what comes by.</span>';
    sceneNote.textContent='A tiny ripple dances in the sunlight.';
  } else {
    actionButton.disabled=false; buttonLabel.textContent='Reel it in';buttonIcon.textContent='✦';
    statusCopy.textContent='There it is — something curious found your line!';
    hint.innerHTML='<span class="hint-icon">♫</span><span>A little friend is waiting.</span>';
    sceneNote.textContent='A small splash. Someone said hello!';
  }
}
function castLine() {
  if(phase==='idle') {
    bobber.x=680+Math.random()*110; bobber.y=411+Math.random()*32;
    setPhase('waiting');
    biteAt=performance.now()+3600+Math.random()*5400;
    sceneNote.textContent='The water keeps its own gentle time.';
    return;
  }
  if(phase==='waiting') {
    setPhase('idle'); showToast('Line tucked away. Cast again whenever you like.'); return;
  }
  const fishIndex=chooseFish();
  counts[fishIndex]++;caught++;
  updateCollection();
  setPhase('idle');
  const fish=fishes[fishIndex];
  sceneNote.textContent=fish.note;
  showToast(`${fish.emoji}  ${fish.name} — what a lovely little catch!`);
  playChime();
  // a gentle, brief celebration sparkle
}
function chooseFish() {
  const weighted=[];
  fishes.forEach((fish,i)=>{for(let n=0;n<(counts[i]===0?4:2);n++)weighted.push(i);});
  return weighted[Math.floor(Math.random()*weighted.length)];
}
function updateCollection() {
  document.getElementById('fish-count').textContent=caught;
  document.getElementById('species-count').textContent=counts.filter(n=>n>0).length;
  const found=counts.filter(n=>n>0).length;
  document.getElementById('collection-progress').textContent=found===6?'The whole cove is your friend':found===0?'A collection in the making':`${found} little ${found===1?'friend':'friends'} so far`;
  fishList.innerHTML='';
  fishes.forEach((fish,i)=>{
    if(counts[i]) {
      const chip=document.createElement('div');chip.className='fish-chip';chip.title=`${fish.name}: caught ${counts[i]} ${counts[i]===1?'time':'times'}`;
      chip.innerHTML=`<span class="fish-emoji">${fish.emoji}</span><span>${fish.name}</span><span class="fish-total">×${counts[i]}</span>`;fishList.appendChild(chip);
    }
  });
  if(!found) fishList.innerHTML='<div class="fish-placeholder"><span>✧</span> Your first friend is out there somewhere…</div>';
}
function showToast(message) {
  toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('show'),3100);
}
actionButton.addEventListener('click',castLine);
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')) {e.preventDefault();castLine();}
  if(e.key==='Escape') document.getElementById('help-dialog').close();
});

const helpDialog=document.getElementById('help-dialog');
document.getElementById('help-button').addEventListener('click',()=>helpDialog.showModal());
document.getElementById('close-help').addEventListener('click',()=>helpDialog.close());
document.getElementById('help-done').addEventListener('click',()=>helpDialog.close());
helpDialog.addEventListener('click',e=>{if(e.target===helpDialog)helpDialog.close();});

function setupAudio() {
  if(!audioContext) {
    audioContext=new (window.AudioContext||window.webkitAudioContext)();
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.18;
    const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
    const low=audioContext.createBiquadFilter();low.type='lowpass';low.frequency.value=440;
    const high=audioContext.createBiquadFilter();high.type='highpass';high.frequency.value=100;
    const gain=audioContext.createGain();gain.gain.value=0;
    source.connect(low).connect(high).connect(gain).connect(audioContext.destination);source.start();
    ambience={gain};
  }
  audioContext.resume();
}
function toggleSound() {
  if(!audioContext) setupAudio();
  soundOn=!soundOn;
  ambience.gain.gain.cancelScheduledValues(audioContext.currentTime);
  ambience.gain.gain.setTargetAtTime(soundOn?.025:0,audioContext.currentTime,.5);
  document.getElementById('sound-icon').textContent=soundOn?'♫':'♪';
  const button=document.getElementById('sound-toggle');
  button.setAttribute('aria-label',soundOn?'Turn ambient sounds off':'Turn ambient sounds on');
  showToast(soundOn?'Soft island sounds, just for you.':'Quiet mode. Just the breeze.');
}
function playChime() {
  if(!soundOn||!audioContext)return;
  [659.25,783.99].forEach((frequency,i)=>{
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,audioContext.currentTime+i*.14);
    gain.gain.exponentialRampToValueAtTime(.08,audioContext.currentTime+i*.14+.035);
    gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+i*.14+.6);
    oscillator.connect(gain).connect(audioContext.destination);oscillator.start(audioContext.currentTime+i*.14);oscillator.stop(audioContext.currentTime+i*.14+.62);
  });
}
document.getElementById('sound-toggle').addEventListener('click',toggleSound);
setInterval(()=>{if(phase==='waiting'&&performance.now()>=biteAt){setPhase('bite');if(soundOn)playChime();}},180);
updateCollection();
