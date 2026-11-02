(() => {
  'use strict';
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, TILE = 16, COLS = 68, ROWS = 50;
  const el = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (x, y) => { let n = x * 374761393 + y * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const saveKey = 'alien-island-field-log-v1';
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(saveKey) || '{}'); } catch (_) {}
  const inventory = Object.assign({ crystal:0, seed:2, fiber:0, ore:0 }, saved.inventory || {});
  const player = { x:saved.x || 34*TILE, y:saved.y || 25*TILE, dir:0, walk:0 };
  const world = { fertility:saved.fertility || 0.08, oxygen:saved.oxygen || 92, time:saved.time || 0.34, zoom:1, planted:saved.planted || [], structures:saved.structures || [], gathered:saved.gathered || [] };
  let keys = new Set(), joy = {x:0,y:0}, last = performance.now(), toastTimer, selected='crystal', gameTime=0;
  const nodes=[];
  function insideIsland(x,y){ const nx=(x-34)/27, ny=(y-25)/19; return nx*nx+ny*ny < 1; }
  function tileType(x,y){ if(!insideIsland(x,y)) return 0; const d=Math.hypot((x-34)/27,(y-25)/19); if(d>.88)return 1; return 2; }
  function createNodes(){
    const used=new Set(world.gathered);
    for(let y=5;y<45;y++) for(let x=6;x<62;x++){
      if(tileType(x,y)!==2 || hash(x,y)>.025) continue;
      const r=hash(x+151,y-73), type=r<.37?'crystal':r<.69?'fiber':'ore';
      const id=`${x},${y}`; if(!used.has(id)) nodes.push({x,y,type,id});
    }
    // Guarantee a welcoming first cluster near the landing beach.
    [[31,27,'crystal'],[35,29,'crystal'],[32,32,'crystal'],[38,23,'fiber'],[27,34,'fiber'],[42,29,'ore']].forEach(([x,y,type],i)=>{const id=`${x},${y}`;if(!used.has(id)&&!nodes.some(n=>n.id===id))nodes.push({x,y,type,id});});
  }
  createNodes();
  function save(){ localStorage.setItem(saveKey,JSON.stringify({inventory,x:player.x,y:player.y,fertility:world.fertility,oxygen:world.oxygen,time:world.time,planted:world.planted,structures:world.structures,gathered:world.gathered})); }
  function notify(message){ const t=el('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2100); }
  function terrainColor(x,y,type){
    const n=hash(x,y);
    if(type===0){const wave=Math.sin(gameTime*1.1+x*.75+y*.45)*2;return ['#427f83','#49898a','#528f8c','#39757d'][Math.floor(n*4)];}
    if(type===1)return ['#c7b98d','#d1c49a','#bdae85','#d8c99a'][Math.floor(n*4)];
    const lush=world.fertility;
    if(lush>.2 && n<lush*1.5)return ['#709c6c','#7da970','#668f66'][Math.floor(n*3)];
    return ['#7d9777','#849a78','#758d72','#899c7b'][Math.floor(n*4)];
  }
  function drawTile(x,y,tx,ty,type){
    const px=Math.floor(tx*TILE),py=Math.floor(ty*TILE);ctx.fillStyle=terrainColor(x,y,type);ctx.fillRect(px,py,TILE,TILE);
    const n=hash(x*5,y*7);
    if(type===0){
      const offset=Math.floor((gameTime*8+x*2+y*3)%17);ctx.fillStyle='#a1cfb453';ctx.fillRect(px+offset%14,py+(offset*3)%15,3,1);if(n>.92){ctx.fillStyle='#74b5a733';ctx.fillRect(px+4,py+5,4,1);}
    } else if(type===1){if(n>.5){ctx.fillStyle='#e5d6a0';ctx.fillRect(px+3,py+10,2,1);ctx.fillRect(px+11,py+4,1,1);} }
    else if(n>.72){ctx.fillStyle=world.fertility>.23?'#a4bf79':'#aab084';ctx.fillRect(px+3,py+5,1,3);ctx.fillRect(px+11,py+11,2,1);}
    if(type===2 && world.fertility>.28 && hash(x+65,y+52)<world.fertility*.055){ctx.fillStyle='#a9f3c8';ctx.globalAlpha=.5+Math.sin(gameTime*3+x)*.3;ctx.fillRect(px+6,py+6,2,2);ctx.globalAlpha=1;}
  }
  function drawPlant(px,py,kind,scale=1){
    ctx.save();ctx.translate(Math.floor(px),Math.floor(py));ctx.scale(scale,scale);
    if(kind==='tree'){
      ctx.fillStyle='#385c4d';ctx.fillRect(-2,-2,5,11);ctx.fillStyle='#426e58';ctx.fillRect(-7,-12,14,12);ctx.fillStyle='#5d9169';ctx.fillRect(-5,-15,10,7);ctx.fillStyle='#80b777';ctx.fillRect(-2,-13,4,3);ctx.fillStyle='#bfdc8a';ctx.fillRect(4,-9,2,2);
    }else if(kind==='shrub'){
      ctx.fillStyle='#416d54';ctx.fillRect(-5,-5,10,6);ctx.fillStyle='#689664';ctx.fillRect(-4,-8,7,5);ctx.fillStyle='#8fbd77';ctx.fillRect(1,-8,3,2);
    }else if(kind==='crystal'){
      ctx.shadowColor='#69eee0';ctx.shadowBlur=8;ctx.fillStyle='#3ba9a5';ctx.fillRect(-2,-10,5,12);ctx.fillStyle='#8df2de';ctx.fillRect(-1,-12,2,3);ctx.fillStyle='#297f89';ctx.fillRect(-5,-5,3,7);ctx.shadowBlur=0;
    }else if(kind==='ore'){
      ctx.fillStyle='#647880';ctx.fillRect(-6,-5,12,7);ctx.fillStyle='#9caeb0';ctx.fillRect(-4,-8,6,4);ctx.fillStyle='#455a65';ctx.fillRect(2,-4,4,5);ctx.fillStyle='#bd9e75';ctx.fillRect(-2,-4,2,2);
    }else if(kind==='flower'){
      ctx.fillStyle='#4e8d68';ctx.fillRect(-1,-3,2,6);ctx.fillStyle='#dc8fc3';ctx.fillRect(-3,-8,3,3);ctx.fillRect(1,-8,3,3);ctx.fillStyle='#f1d78d';ctx.fillRect(-1,-7,3,2);ctx.shadowColor='#eca2e2';ctx.shadowBlur=5;ctx.fillStyle='#eda6dc';ctx.fillRect(-1,-8,2,2);ctx.shadowBlur=0;
    }
    ctx.restore();
  }
  function drawStructure(s){const px=s.x*TILE+8,py=s.y*TILE+8;
    if(s.type==='beacon'){ctx.fillStyle='#385c60';ctx.fillRect(px-7,py-2,14,10);ctx.fillStyle='#6eb39a';ctx.fillRect(px-5,py-8,10,8);ctx.fillStyle='#c0f6cd';ctx.fillRect(px-2,py-12,4,5);ctx.shadowColor='#a4f5c2';ctx.shadowBlur=12;ctx.fillStyle='#b8f5c5';ctx.fillRect(px-1,py-15,2,3);ctx.shadowBlur=0;}
    else{ctx.fillStyle='#526e71';ctx.fillRect(px-8,py-5,16,11);ctx.fillStyle='#8cc6ac';ctx.fillRect(px-5,py-9,10,5);ctx.fillStyle='#a8ede1';ctx.fillRect(px-2,py-7,4,2);ctx.fillStyle='#45625e';ctx.fillRect(px-2,py+1,4,5);}
  }
  function drawPlayer(sx,sy){const bob=Math.sin(player.walk)*1.3;const x=Math.round(sx),y=Math.round(sy+bob);
    ctx.fillStyle='#233940';ctx.fillRect(x-4,y+1,9,7);ctx.fillStyle='#617d73';ctx.fillRect(x-5,y+5,4,3);ctx.fillRect(x+2,y+5,4,3);
    ctx.fillStyle='#d9e7d8';ctx.fillRect(x-4,y-8,8,9);ctx.fillStyle='#edf4dc';ctx.fillRect(x-4,y-12,8,6);ctx.fillStyle='#bbd5ca';ctx.fillRect(x-3,y-14,6,3);ctx.fillStyle='#93c5b7';ctx.fillRect(x+1,y-10,3,3);ctx.fillStyle='#e9bb73';ctx.fillRect(x+3,y-3,2,2);
    ctx.fillStyle='#f0f3db';ctx.fillRect(x-5,y-6,2,5);ctx.fillRect(x+4,y-6,2,5);
  }
  function render(){
    const scale=world.zoom, viewW=W/scale,viewH=H/scale;const camX=clamp(player.x-TILE/2-viewW/2,0,COLS*TILE-viewW),camY=clamp(player.y-TILE/2-viewH/2,0,ROWS*TILE-viewH);
    ctx.save();ctx.scale(scale,scale);ctx.translate(-camX,-camY);
    const x0=Math.floor(camX/TILE)-1,x1=Math.ceil((camX+viewW)/TILE)+1,y0=Math.floor(camY/TILE)-1,y1=Math.ceil((camY+viewH)/TILE)+1;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)drawTile(x,y,x,y,tileType(x,y));
    // scattered silhouettes establish forest depth without costly post effects
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(tileType(x,y)===2&&hash(x+25,y-18)>.91){const kind=hash(x-11,y+38)>.65?'tree':'shrub';drawPlant(x*TILE+8,y*TILE+14,kind,.75);}
    nodes.forEach(n=>{if(n.x<x0-1||n.x>x1+1||n.y<y0-1||n.y>y1+1)return;drawPlant(n.x*TILE+8,n.y*TILE+14,n.type==='crystal'?'crystal':n.type==='ore'?'ore':'shrub');});
    world.planted.forEach(p=>{if(p.x>=x0-1&&p.x<=x1+1&&p.y>=y0-1&&p.y<=y1+1)drawPlant(p.x*TILE+8,p.y*TILE+14,'flower',p.grown?1:.7);});
    world.structures.forEach(drawStructure);
    // small alien moths wander in the revitalized canopy
    if(world.fertility>.16)for(let i=0;i<4;i++){const mx=player.x+Math.sin(gameTime*.35+i*2.7)*95+Math.sin(gameTime*.9+i)*25,my=player.y-28+Math.cos(gameTime*.4+i*3)*52;ctx.fillStyle='#d3f0b5aa';ctx.fillRect(Math.floor(mx),Math.floor(my),2,2);}
    drawPlayer(player.x,player.y);
    // Interaction halo
    const near=nearestNode();if(near&&distance(near.x*TILE+8,near.y*TILE+8,player.x,player.y)<TILE*1.5){ctx.strokeStyle='#e5f4c89c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(near.x*TILE+8,near.y*TILE+8,12,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    const dayLight=(Math.sin(world.time*Math.PI*2-Math.PI/2)+1)/2;const darkness=clamp(.5-dayLight,0,.37);if(darkness>.02){ctx.fillStyle=`rgba(18,35,65,${darkness})`;ctx.fillRect(0,0,W,H);}
    if(dayLight<.22){ctx.fillStyle='rgba(102,105,181,.10)';ctx.fillRect(0,0,W,H);}
    updateHUD();
  }
  function distance(x,y,a,b){return Math.hypot(x-a,y-b)}
  function nearestNode(){let best=null,bd=Infinity;for(const n of nodes){const d=distance(n.x*TILE+8,n.y*TILE+8,player.x,player.y);if(d<bd){bd=d;best=n;}}return best;}
  function updateHUD(){
    const mins=Math.floor((world.time%1)*24*60),hr=Math.floor(mins/60),minute=mins%60;el('clock').innerHTML=`DAY ${String(Math.floor(world.time)+1).padStart(2,'0')} <b>${String(hr).padStart(2,'0')}:${String(minute).padStart(2,'0')}</b>`;
    const percent=Math.round(world.fertility*100);el('vitality-number').textContent=String(percent).padStart(2,'0')+'%';el('vitality-fill').style.width=percent+'%';el('world-caption').textContent=percent>55?'A living world, full of promise':percent>25?'Green shoots are finding their way':'A quiet world, waiting to breathe';
    el('oxygen-fill').style.width=clamp(world.oxygen,4,100)+'%';el('oxygen-value').textContent=Math.round(world.oxygen)+'%';
    ['crystal','seed','fiber','ore'].forEach(k=>el('count-'+k).textContent=inventory[k]);el('item-total').textContent=String(Object.values(inventory).reduce((a,b)=>a+b,0)).padStart(2,'0');
    const c=inventory.crystal;el('mission-progress').style.width=Math.min(100,c/3*100)+'%';el('mission-count').textContent=`${Math.min(c,3)} / 3`;
    if(c>=3&&world.structures.some(s=>s.type==='beacon')){el('mission-title').textContent='Let life take root';el('mission-description').textContent='Plant 3 alien seeds to bring the canopy back.';el('mission-progress').style.width=Math.min(100,world.planted.length/3*100)+'%';el('mission-count').textContent=`${Math.min(world.planted.length,3)} / 3`;}
    else if(c>=3){el('mission-title').textContent='Build a seed beacon';el('mission-description').textContent='Open craft and build a beacon to awaken the soil.';el('mission-progress').style.width='100%';el('mission-count').textContent='3 / 3';}
  }
  function move(dt){let dx=0,dy=0;if(keys.has('ArrowLeft')||keys.has('a'))dx--;if(keys.has('ArrowRight')||keys.has('d'))dx++;if(keys.has('ArrowUp')||keys.has('w'))dy--;if(keys.has('ArrowDown')||keys.has('s'))dy++;dx+=joy.x;dy+=joy.y;const mag=Math.hypot(dx,dy);if(mag>1){dx/=mag;dy/=mag;}if(mag>.1){const speed=52;const nx=clamp(player.x+dx*speed*dt,8,COLS*TILE-8),ny=clamp(player.y+dy*speed*dt,8,ROWS*TILE-8);if(tileType(Math.floor(nx/TILE),Math.floor(player.y/TILE))!==0)player.x=nx;if(tileType(Math.floor(player.x/TILE),Math.floor(ny/TILE))!==0)player.y=ny;player.walk+=dt*12;player.dir=Math.atan2(dy,dx);} }
  function interact(){const n=nearestNode();if(n&&distance(n.x*TILE+8,n.y*TILE+8,player.x,player.y)<TILE*1.7){inventory[n.type]++;world.gathered.push(n.id);nodes.splice(nodes.indexOf(n),1);notify(`${n.type==='crystal'?'Crystal shard':n.type==='fiber'?'Vine fiber':'Lunar ore'} collected`);save();return;}
    const plantSpot=world.planted.find(p=>distance(p.x*TILE+8,p.y*TILE+8,player.x,player.y)<TILE*1.5);if(plantSpot){plantSpot.grown=true;world.fertility=clamp(world.fertility+.02,0,1);notify('Your little seedling is growing ✦');save();return;}
    const structure=world.structures.find(s=>distance(s.x*TILE+8,s.y*TILE+8,player.x,player.y)<TILE*1.8);if(structure){if(structure.type==='purifier'){world.oxygen=100;notify('Water purified · suit oxygen restored');}else{world.fertility=clamp(world.fertility+.025,0,1);notify('Seed beacon humming · soil restored');}save();return;}
    notify('Nothing nearby — wander toward a glimmer.');
  }
  function plantSeed(){if(!inventory.seed){notify('No seeds left — gather a little more.');return;}const x=Math.floor(player.x/TILE),y=Math.floor(player.y/TILE);if(tileType(x,y)===0){notify('Find a patch of land to plant.');return;}if(world.planted.some(p=>p.x===x&&p.y===y)){notify('There is already a seedling here.');return;}inventory.seed--;world.planted.push({x,y,grown:false});world.fertility=clamp(world.fertility+.055,0,1);world.oxygen=clamp(world.oxygen+1.5,0,100);notify('A new life takes root · island vitality +5');save();}
  const recipes=[
    {type:'beacon',name:'Seed beacon',desc:'Softly coaxes dormant soil back to life.',cost:{crystal:3,fiber:2,ore:1},icon:'✧'},
    {type:'purifier',name:'Water purifier',desc:'Purifies a small freshwater spring.',cost:{crystal:1,fiber:3,ore:2},icon:'◉'},
    {type:'seed',name:'Gathering pouch',desc:'A field-made pouch with two saved seeds.',cost:{fiber:3,ore:1},icon:'✦'}
  ];
  function openCraft(){el('modal-title').textContent='Craft & build';el('modal-intro').textContent='Make something good for this little world.';el('recipe-list').innerHTML='';recipes.forEach(r=>{const can=Object.entries(r.cost).every(([k,v])=>inventory[k]>=v);const item=document.createElement('div');item.className='recipe';item.innerHTML=`<div><div class="recipe-title">${r.icon} &nbsp;${r.name}</div><div class="recipe-needs">${r.desc}<br>NEEDS &nbsp;${Object.entries(r.cost).map(([k,v])=>`${v} ${k.toUpperCase()}`).join(' · ')}</div></div><button ${can?'':'disabled'}>${r.type==='seed'?'MAKE':'BUILD'}</button>`;item.querySelector('button').onclick=()=>craft(r);el('recipe-list').appendChild(item);});el('modal-backdrop').classList.add('open');}
  function craft(r){if(!Object.entries(r.cost).every(([k,v])=>inventory[k]>=v)){notify('Not quite enough materials yet.');return;}Object.entries(r.cost).forEach(([k,v])=>inventory[k]-=v);if(r.type==='seed'){inventory.seed+=2;notify('Two seeds tucked into your pack.');}else{const x=Math.floor(player.x/TILE),y=Math.floor(player.y/TILE);if(tileType(x,y)===0){notify('Build on land, not in the shallows.');Object.entries(r.cost).forEach(([k,v])=>inventory[k]+=v);return;}world.structures.push({type:r.type,x,y});if(r.type==='beacon'){world.fertility=clamp(world.fertility+.16,0,1);notify('Seed beacon online · the island stirs ✨');}else{world.oxygen=100;notify('Water purifier online · oxygen restored');}}save();openCraft();}
  function toggleInventory(){el('modal-title').textContent='Field inventory';el('modal-intro').textContent='Everything you have gathered on this little world.';el('recipe-list').innerHTML=`<div class="recipe"><div><div class="recipe-title">◆ &nbsp;Crystal shards</div><div class="recipe-needs">POWER SOURCE · ${inventory.crystal} IN PACK</div></div></div><div class="recipe"><div><div class="recipe-title">✦ &nbsp;Alien seeds</div><div class="recipe-needs">LIFE IN WAITING · ${inventory.seed} IN PACK</div></div></div><div class="recipe"><div><div class="recipe-title">〰 &nbsp;Vine fiber</div><div class="recipe-needs">GENTLE, FLEXIBLE MATERIAL · ${inventory.fiber} IN PACK</div></div></div><div class="recipe"><div><div class="recipe-title">⬡ &nbsp;Lunar ore</div><div class="recipe-needs">ANCIENT METAL · ${inventory.ore} IN PACK</div></div></div>`;el('modal-backdrop').classList.add('open');}
  function closeModal(){el('modal-backdrop').classList.remove('open');}
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;gameTime+=dt;move(dt);world.time=(world.time+dt/180)%1;if(world.oxygen>12)world.oxygen-=dt*.006;render();if(Math.floor(now/5000)!==Math.floor((now-dt*1000)/5000))save();requestAnimationFrame(frame);}
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k==='e')interact();if(k==='q')plantSeed();if(k==='escape')closeModal();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>keys.clear());
  const useAction=()=>selected==='seed'?plantSeed():interact();
  el('interact-button').onclick=useAction;el('mobile-interact').onclick=useAction;el('craft-button').onclick=openCraft;el('mobile-craft').onclick=openCraft;el('inventory-button').onclick=toggleInventory;el('modal-close').onclick=closeModal;el('modal-backdrop').addEventListener('click',e=>{if(e.target===el('modal-backdrop'))closeModal();});
  document.querySelectorAll('.resource-slot').forEach(b=>b.onclick=()=>{document.querySelectorAll('.resource-slot').forEach(x=>x.classList.remove('active'));b.classList.add('active');selected=b.dataset.item;if(selected==='seed')notify('Tap USE or press Q to plant a seed.');});
  el('zoom-button').onclick=()=>{world.zoom=world.zoom===1?1.25:world.zoom===1.25?1.5:1;notify(`Camera zoom ${Math.round(world.zoom*100)}%`);};
  el('help-button').onclick=()=>el('help-pop').classList.toggle('open');el('help-ok').onclick=()=>el('help-pop').classList.remove('open');
  // Pointer joystick; the same controls work with a finger or mouse.
  const joystick=el('joystick'),knob=el('joystick-knob');let joyPointer=null;
  function setJoy(e){const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,m=Math.hypot(dx,dy),s=Math.min(1,max/Math.max(1,m));joy.x=dx*s/max;joy.y=dy*s/max;knob.style.transform=`translate(${dx*s}px,${dy*s}px)`;}
  joystick.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joystick.setPointerCapture(joyPointer);setJoy(e);});joystick.addEventListener('pointermove',e=>{if(joyPointer===e.pointerId)setJoy(e);});const joyEnd=()=>{joyPointer=null;joy.x=joy.y=0;knob.style.transform='translate(0,0)';};joystick.addEventListener('pointerup',joyEnd);joystick.addEventListener('pointercancel',joyEnd);
  // Mobile USE plants the selected seed, or interacts with nearby resources otherwise.
  el('mobile-interact').addEventListener('contextmenu',e=>e.preventDefault());
  // Tap the world to plant a selected seed; keyboard shortcut Q is available on desktop too.
  canvas.addEventListener('pointerdown',e=>{if(selected!=='seed')return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;const vw=W/world.zoom,vh=H/world.zoom,cx=clamp(player.x-TILE/2-vw/2,0,COLS*TILE-vw),cy=clamp(player.y-TILE/2-vh/2,0,ROWS*TILE-vh);const tx=Math.floor((x/world.zoom+cx)/TILE),ty=Math.floor((y/world.zoom+cy)/TILE);if(distance(tx*TILE+8,ty*TILE+8,player.x,player.y)<TILE*4){if(inventory.seed>0&&tileType(tx,ty)!==0&&!world.planted.some(p=>p.x===tx&&p.y===ty)){inventory.seed--;world.planted.push({x:tx,y:ty,grown:false});world.fertility=clamp(world.fertility+.055,0,1);world.oxygen=clamp(world.oxygen+1.5,0,100);notify('A new life takes root · island vitality +5');save();}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});window.addEventListener('beforeunload',save);
  requestAnimationFrame(frame);
})();
