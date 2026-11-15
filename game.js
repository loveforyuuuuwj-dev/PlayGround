(() => {
  const $ = id => document.getElementById(id);
  const spots = [
    {name:'Willowmere Lake',mood:'A gentle breeze',unlock:1,fish:['Sunscale','Pond perch','Bluegill','Reed carp','Silver dace']},
    {name:'Mossy Creek',mood:'Cool and clear',unlock:2,fish:['Brook trout','Stone loach','Golden minnow','Creek chub','Fernfin']},
    {name:'Moonpetal Cove',mood:'Quiet as a dream',unlock:4,fish:['Moon koi','Starry char','Lanternfish','Pearl bass','Nightfin']}
  ];
  const fishInfo = {
    'Sunscale':['🐠','A bright little sunbeam of a fish.'], 'Pond perch':['🐟','Found where the lily pads gather.'],
    'Bluegill':['🐟','Curious, cheerful, and quick to nibble.'], 'Reed carp':['🐡','A patient fish with lovely golden fins.'],
    'Silver dace':['🐟','A silver flash in the morning water.'], 'Brook trout':['🐟','Loves the cold, clear current.'],
    'Stone loach':['🐠','A shy bottom-dweller with whiskers.'], 'Golden minnow':['🐟','So tiny it almost looks like a leaf.'],
    'Creek chub':['🐡','A sturdy friend from the shallows.'], 'Fernfin':['🐠','Its green-tinged fins blend with the creek.'],
    'Moon koi':['🐠','A rare visitor, patterned like moonlight.'], 'Starry char':['🐟','Little silver speckles shine on its back.'],
    'Lanternfish':['🐡','A gentle glow follows it through the water.'], 'Pearl bass':['🐠','A rare, pearly shimmer in the cove.'], 'Nightfin':['🐟','A quiet mystery beneath the surface.']
  };
  const initial = {coins:24,xp:0,level:1,rod:1,spot:0,total:0,catchesToday:0,quest:0,questDone:false,day:1,bag:[],caughtKinds:[],sound:false};
  let saved; try{saved=JSON.parse(localStorage.getItem('stillwater-save')||'null')}catch(e){}
  const state={...initial,...(saved||{})};
  let phase='ready', biteTimeout=null, biteInterval=null, castTimeout=null, toastTimeout=null;
  let soundCtx=null, startAt=Date.now();
  const store=()=>{try{localStorage.setItem('stillwater-save',JSON.stringify(state))}catch(e){}};
  const toast=msg=>{const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2500)};
  const xpNeeded=()=>80+state.level*40;
  const render=()=>{
    const spot=spots[state.spot]||spots[0];
    $('spotName').textContent=spot.name;$('spotMood').textContent=spot.mood;
    $('level').textContent=state.level;$('dayNum').textContent=state.day;
    $('coinTotal').textContent=state.coins;$('rodLevel').textContent=`Level ${state.rod}`;
    $('todayCatch').textContent=`${state.catchesToday} ${state.catchesToday===1?'fish':'fish'}`;
    $('journalCount').textContent=state.total;
    $('xpFill').style.width=`${Math.min(100,state.xp/xpNeeded()*100)}%`;
    $('questFill').style.width=`${Math.min(100,state.quest/3*100)}%`;
    $('questProgress').textContent=state.questDone?'Complete!':`${Math.min(3,state.quest)} / 3`;
    $('questTitle').textContent=state.questDone?'A kindness returned':'A gift for Marnie';
    $('questDesc').textContent=state.questDone?'Marnie is delighted. The café is always open.':'Catch any 3 fish for the lakeside café.';
    $('upgradeBtn').disabled=state.coins<(40+(state.rod-1)*30)||state.rod>=5||phase!=='ready';
    $('upgradeBtn').innerHTML=state.rod>=5?'Rod fully improved ✦':`Improve rod <b>${40+(state.rod-1)*30} ◉</b>`;
    $('spotMenu').innerHTML=spots.map((s,i)=>`<button class="spot-option ${state.level<s.unlock?'locked':''}" data-spot="${i}"><span>${s.name}</span><small>${state.level<s.unlock?`Lv. ${s.unlock} 🔒`:i===state.spot?'Here ✓':'Visit'}</small></button>`).join('');
    const grouped={};state.bag.forEach(f=>grouped[f.name]=(grouped[f.name]||0)+1);
    const list=$('collectionList');
    if(!state.bag.length) list.innerHTML='<div class="empty-state"><span>🐟</span><p>Your first catch is waiting<br>to become a story.</p></div>';
    else list.innerHTML=`<div class="catch-list">${Object.entries(grouped).slice(-5).reverse().map(([name,n])=>`<div class="catch-item"><span class="fish-icon">${fishInfo[name]?.[0]||'🐟'}</span><div><b>${name}</b><small>× ${n} · ${n*fishValue(name)} ◉</small></div></div>`).join('')}</div>`;
    $('journalTotal').textContent=state.total;$('journalKinds').textContent=state.caughtKinds.length;$('journalCoins').textContent=state.coins;
    $('journalEntries').innerHTML=state.caughtKinds.length?state.caughtKinds.slice().reverse().map(name=>`<div class="journal-entry"><span>${fishInfo[name]?.[0]||'🐟'}</span><div><b>${name}</b><small>${fishInfo[name]?.[1]||'A lovely catch from the lake.'}</small></div></div>`).join(''):'<div class="journal-empty">Nothing in the journal just yet.<br>Cast a line and see who says hello.</div>';
    const sale=state.bag.reduce((sum,f)=>sum+fishValue(f.name),0);
    $('sellBtn').textContent=`Sell today's catch · ${sale} ◉`;$('sellBtn').disabled=!state.bag.length;
    $('weatherLabel').textContent=state.day%4===0?'Light rain':state.day%3===0?'Cloudy':'Clear skies';
    $('weatherIcon').textContent=state.day%4===0?'🌦️':state.day%3===0?'☁️':'☀️';
    $('weatherTitle').textContent=state.day%4===0?'A little spring rain':state.day%3===0?'Clouds drift by':'Soft morning light';
    $('weatherDesc').textContent=state.day%4===0?'A cozy sort of day to watch the water.':state.day%3===0?'The fish are enjoying the cooler shade.':'Perfect weather for a quiet day by the water.';
  };
  function fishValue(name){return name==='Moon koi'||name==='Pearl bass'?18:name==='Starry char'||name==='Lanternfish'?12:name==='Brook trout'||name==='Fernfin'?9:5}
  const setStatus=(text,kind='')=>{$('statusText').textContent=text;$('statusDot').className='status-dot'+(kind?' '+kind:'')};
  const clearTimers=()=>{clearTimeout(castTimeout);clearTimeout(biteTimeout);clearInterval(biteInterval)};
  function cast(){if(phase!=='ready')return;phase='waiting';$('castBtn').disabled=true;$('castBtn').textContent='… Listening';$('reelBtn').hidden=true;$('biteMeter').hidden=true;setStatus('A line rests on the water','waiting');$('promptTitle').textContent='The lake takes a slow breath.';$('promptText').textContent='You hear the reeds rustle. Somewhere, a fish is thinking about it.';$('castHint').textContent='Take your time · the fish are nearby';$('bobber').classList.remove('biting');$('bobber').style.top='64%';
    const wait=4200+Math.random()*5600-Math.min(1200,(state.rod-1)*250);
    castTimeout=setTimeout(()=>{if(phase==='waiting')bite()},wait);store();
  }
  function bite(){phase='bite';setStatus('A little tug on your line!','bite');$('promptTitle').textContent='Oh! Something’s nibbling!';$('promptText').textContent='Tap “Reel it in” to see who came to say hello.';$('castBtn').hidden=true;$('reelBtn').hidden=false;$('biteMeter').hidden=false;$('bobber').classList.add('biting');
    let left=100;const windowMs=5200+state.rod*650;$('biteFill').style.width='100%';biteInterval=setInterval(()=>{left-=10000/windowMs;$('biteFill').style.width=Math.max(0,left)+'%'},100);
    biteTimeout=setTimeout(()=>{if(phase==='bite')missed()},windowMs);
  }
  function resetFishing(){clearTimers();phase='ready';$('castBtn').hidden=false;$('castBtn').disabled=false;$('castBtn').innerHTML='<span>⌁</span> Cast a line';$('reelBtn').hidden=true;$('biteMeter').hidden=true;$('bobber').classList.remove('biting');$('bobber').style.top='66%';render()}
  function missed(){phase='ready';setStatus('A fish slipped away','');$('promptTitle').textContent='Just a little nibble.';$('promptText').textContent='No worries. The lake is full of second chances.';toast('A fish got away — cast again whenever you like.');resetFishing()}
  function reel(){if(phase!=='bite')return;clearTimers();phase='ready';const spot=spots[state.spot];const pool=spot.fish;let name=pool[Math.floor(Math.random()*pool.length)];if(state.rod>=2&&Math.random()<.12*state.rod)name=spot.fish.slice(-2)[Math.floor(Math.random()*2)];const isNew=!state.caughtKinds.includes(name);state.total++;state.catchesToday++;state.bag.push({name,at:Date.now(),spot:spot.name});if(isNew)state.caughtKinds.push(name);state.xp+=12;
    let levelUp=false;while(state.xp>=xpNeeded()){state.xp-=xpNeeded();state.level++;levelUp=true}
    if(!state.questDone){state.quest++;if(state.quest>=3){state.questDone=true;state.coins+=35;state.xp+=20;toast('Marnie’s request complete! +35 coins · +20 XP')}}
    if(state.catchesToday>0&&state.catchesToday%8===0)state.day++;
    store();$('bobber').classList.remove('biting');setStatus(isNew?'A new friend for your journal':'A lovely little catch','');$('promptTitle').textContent=`You caught a ${name}!`;$('promptText').textContent=fishInfo[name]?.[1]||'A lovely catch from the water.';$('sceneCaption').textContent=isNew?`${name} — a new friend for your journal.`:`A ${name} shimmers in the morning light.`;
    resetFishing();if(levelUp){toast(`You reached level ${state.level}! New waters are opening.`)}else if(isNew&&state.questDone)toast(`New discovery: ${name} ✦`);else if(!state.questDone&&state.quest===1)toast('Marnie would be so happy to see this one!');
  }
  $('castBtn').addEventListener('click',cast);$('reelBtn').addEventListener('click',reel);
  $('spotSwitch').addEventListener('click',()=>{$('spotMenu').hidden=!$('spotMenu').hidden});
  $('spotMenu').addEventListener('click',e=>{const btn=e.target.closest('[data-spot]');if(!btn)return;const i=+btn.dataset.spot;if(state.level<spots[i].unlock){toast(`Reach level ${spots[i].unlock} to visit ${spots[i].name}.`);return}state.spot=i;$('spotMenu').hidden=true;$('sceneCaption').textContent=i===0?'A pair of ducks drift past the reeds.':i===1?'The creek tumbles gently over smooth stones.':'A quiet shimmer dances across the cove.';render();store();toast(`You settled in at ${spots[i].name}.`)});
  $('upgradeBtn').addEventListener('click',()=>{const cost=40+(state.rod-1)*30;if(state.rod>=5){toast('Your rod is already in lovely shape.');return}if(state.coins<cost){toast(`You need ${cost} coins for the next rod upgrade.`);return}state.coins-=cost;state.rod++;render();store();toast(`Rod improved to level ${state.rod}! Fish have a little longer to bite.`)});
  const modal=$('journalModal');const openJournal=()=>{modal.hidden=false;render();$('modalClose').focus()};const closeJournal=()=>{modal.hidden=true;$('journalOpen').focus()};
  $('journalOpen').addEventListener('click',openJournal);$('viewAll').addEventListener('click',openJournal);$('modalClose').addEventListener('click',closeJournal);modal.addEventListener('click',e=>{if(e.target===modal)closeJournal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeJournal()});
  $('sellBtn').addEventListener('click',()=>{if(!state.bag.length)return;const total=state.bag.reduce((sum,f)=>sum+fishValue(f.name),0);state.coins+=total;const n=state.bag.length;state.bag=[];render();store();toast(`The café bought ${n} ${n===1?'fish':'fish'} for ${total} coins.`)});
  $('soundBtn').addEventListener('click',()=>{state.sound=!state.sound;$('soundBtn').style.background=state.sound?'#dceadf':'';if(state.sound){try{soundCtx=soundCtx||new(window.AudioContext||window.webkitAudioContext)();const osc=soundCtx.createOscillator(),gain=soundCtx.createGain();osc.type='sine';osc.frequency.value=432;gain.gain.value=.018;osc.connect(gain);gain.connect(soundCtx.destination);osc.start();osc.stop(soundCtx.currentTime+.12)}catch(e){}toast('A soft lake chime. More ambient sounds soon.')}else toast('Ambient sound off.')} );
  setInterval(()=>{const mins=Math.floor((Date.now()-startAt)/60000);const hour=(8+Math.floor(mins/3))%24;$('timeLabel').textContent=hour<11?'Morning':hour<16?'Afternoon':hour<20?'Evening':'Night'},30000);
  render();
})();
