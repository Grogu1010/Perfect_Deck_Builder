(function(){
  'use strict';
  const E=window.DeckEngine, D=window.DECK_DATA;
  const $=id=>document.getElementById(id);
  const state={deck:[],locked:new Set(),banned:new Set(),pickerIndex:null};
  const STORAGE='cr-perfect-deck-builder-v1';
  const TIER_LABEL=['Missing','Good','Great','Incredible'];

  function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2200)}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify({deck:state.deck,locked:[...state.locked],banned:[...state.banned]}))}catch(_){}}
  function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');if(x){state.deck=(x.deck||[]).filter(n=>E.CARD_BY_NAME.has(n)).slice(0,8);state.locked=new Set((x.locked||[]).filter(n=>state.deck.includes(n)));state.banned=new Set((x.banned||[]).filter(n=>E.CARD_BY_NAME.has(n)));}}catch(_){}}

  function artUrls(card){
    const fill=t=>t.replace('{slug}',card.slug);
    return [fill(D.art.primary),...(D.art.fallback||[]).map(fill)];
  }
  function bindArt(img,card){
    if(!card){img.removeAttribute('src');return;}
    const urls=artUrls(card);let i=0;
    const next=()=>{if(i>=urls.length){img.onerror=null;img.src=fallbackSvg(card.name);return;}img.src=urls[i++];};
    img.onerror=next;img.referrerPolicy='no-referrer';next();
  }
  function fallbackSvg(name){
    const initials=name.split(/\s+/).map(x=>x[0]).join('').slice(0,3).replace(/[<>&]/g,'');
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="220"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#24365f"/><stop offset="1" stop-color="#17213c"/></linearGradient></defs><rect width="100%" height="100%" rx="18" fill="url(#g)"/><circle cx="90" cy="90" r="48" fill="#39558b"/><text x="90" y="102" text-anchor="middle" font-family="Arial" font-weight="700" font-size="34" fill="#dce9ff">${initials}</text><text x="90" y="172" text-anchor="middle" font-family="Arial" font-size="12" fill="#9db1d9">${name.replace(/[<>&]/g,'')}</text></svg>`);
  }

  function renderTower(){const c=E.CARD_BY_NAME.get(D.towerTroop);const img=document.createElement('img');img.alt=D.towerTroop;bindArt(img,c);$('towerFixed').replaceChildren(img)}

  function specialBadge(cardName,specials){
    const bits=[];
    if(E.CHAMPIONS.has(cardName)) bits.push('<span class="badge champ">CHAMPION</span>');
    if(specials.evoSlot===cardName) bits.push('<span class="badge evo">EVO</span>');
    if(specials.heroSlot===cardName) bits.push('<span class="badge hero">HERO</span>');
    if(specials.wildSlot===cardName) bits.push(`<span class="badge wild">WILD ${specials.wildType==='Evolution'?'EVO':'HERO'}</span>`);
    return bits.join('');
  }

  function renderDeck(){
    const grid=$('deckGrid');grid.innerHTML='';
    const specials=E.autoSpecials(state.deck);
    for(let i=0;i<8;i++){
      const name=state.deck[i];
      if(!name){
        const empty=document.createElement('button');empty.type='button';empty.className='deck-card empty';empty.innerHTML='<span>＋<br><small>Choose card</small></span>';empty.addEventListener('click',()=>openPicker(i));grid.appendChild(empty);continue;
      }
      const card=E.CARD_BY_NAME.get(name), wrap=document.createElement('article');wrap.className='deck-card';
      wrap.innerHTML=`<img alt="${escapeHtml(name)}"><div class="shade"></div><span class="elixir-badge">${card.elixir}</span><div class="special-badges">${specialBadge(name,specials)}</div><div class="card-name">${escapeHtml(name)}</div><div class="card-actions"><button type="button" class="mini-btn lock ${state.locked.has(name)?'active':''}">${state.locked.has(name)?'🔒 Locked':'🔓 Lock'}</button><button type="button" class="mini-btn swap" ${state.locked.has(name)?'disabled':''}>↻ Best swap</button></div>`;
      bindArt(wrap.querySelector('img'),card);
      wrap.querySelector('.lock').addEventListener('click',ev=>{ev.stopPropagation();toggleLock(name)});
      wrap.querySelector('.swap').addEventListener('click',ev=>{ev.stopPropagation();replaceDisliked(i)});
      wrap.addEventListener('click',()=>openPicker(i));grid.appendChild(wrap);
    }
    $('evoSlot').textContent=specials.evoSlot||'—';
    $('heroSlot').textContent=specials.heroSlot||'—';
    $('wildSlot').textContent=specials.wildSlot?`${specials.wildSlot} · ${specials.wildType}`:'—';
  }

  function escapeHtml(s){return String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}
  function toggleLock(name){if(state.locked.has(name))state.locked.delete(name);else state.locked.add(name);save();render()}

  function renderChips(){
    const locked=$('lockedChips'), banned=$('bannedChips');locked.innerHTML='';banned.innerHTML='';
    if(!state.locked.size)locked.innerHTML='<span class="muted">none</span>';
    [...state.locked].forEach(name=>locked.appendChild(makeChip(name,()=>{state.locked.delete(name);save();render()})));
    if(!state.banned.size)banned.innerHTML='<span class="muted">none</span>';
    [...state.banned].forEach(name=>banned.appendChild(makeChip(name,()=>{state.banned.delete(name);save();render()})));
  }
  function makeChip(name,onRemove){const c=document.createElement('span');c.className='chip';c.append(document.createTextNode(name));const b=document.createElement('button');b.type='button';b.textContent='×';b.addEventListener('click',onRemove);c.appendChild(b);return c}

  function renderScore(){
    const r=E.deckMetrics(state.deck), ex=E.explainDeck(state.deck,{locked:[...state.locked],banned:[...state.banned]});
    const score=Math.round(r.score);$('scoreValue').textContent=score;$('scoreRing').style.setProperty('--p',score);$('avgElixir').textContent=state.deck.length?r.avgElixir.toFixed(2):'—';
    $('scoreTitle').textContent=r.perfect?'Perfect deck':state.deck.length===8?`${r.criteria.filter(c=>c.met).length}/${r.criteria.length} targets hit`:'Build or fill the deck';
    $('scoreSubtitle').textContent=r.perfect?'Every target in your Perfect Deck model is satisfied.':state.deck.length===8?'Closest score from the current eight cards.':'Generate from nothing or choose cards manually.';
    $('headlineStats').innerHTML=`<div class="stat"><span>Counter coverage</span><strong>${r.counters.goodOrBetter}/${D.counterTargets.length}</strong></div><div class="stat"><span>Incredible counters</span><strong>${r.counters.incredible}/5</strong></div><div class="stat"><span>Good+ synergies</span><strong>${r.synergies.goodOrBetter}</strong></div><div class="stat"><span>Champions</span><strong>${r.championCount}/${D.perfect.maxChampions}</strong></div>`;

    $('criteriaGrid').innerHTML=r.criteria.map(c=>`<div class="criterion ${c.met?'met':''}"><span class="state">${c.met?'✓':'!'}</span><b>${escapeHtml(c.label)}</b><small>${escapeHtml(c.detail)}</small><span class="progress"><i style="width:${Math.round(c.progress*100)}%"></i></span></div>`).join('');
    $('adviceList').innerHTML=ex.notes.slice(0,9).map(n=>`<div class="advice ${n.kind}">${escapeHtml(n.text)}</div>`).join('');
    renderSwaps(ex.swaps);
    renderCounters(r);renderSynergies(r);
  }

  function renderSwaps(swaps){
    const box=$('swapSuggestions');
    if(!swaps.length){box.innerHTML=state.deck.length===8?'<div class="empty-msg">No single-card swap raises the score. Use “Improve current” for a multi-card search.</div>':'';return;}
    box.innerHTML='<p class="eyebrow">BEST ONE-CARD UPGRADES</p>';
    swaps.slice(0,4).forEach(s=>{
      const row=document.createElement('div');row.className='swap';row.innerHTML=`<span><strong>${escapeHtml(s.out)}</strong> → <strong>${escapeHtml(s.in)}</strong><br><span class="muted">+${s.delta.toFixed(1)} points · ${s.score.toFixed(1)}%</span></span><button type="button">Apply</button>`;
      row.querySelector('button').addEventListener('click',()=>{state.deck=[...s.deck];save();render();toast(`Swapped ${s.out} for ${s.in}`)});box.appendChild(row);
    });
  }

  function renderCounters(r){
    $('counterSummary').textContent=`${r.counters.incredible} Incredible · ${r.counters.greatOrBetter} Great+ · ${r.counters.goodOrBetter} Good+`;
    const grid=$('counterGrid');grid.innerHTML='';
    D.counterTargets.forEach(target=>{
      const cov=r.counters.coverage[target], c=E.CARD_BY_NAME.get(target), item=document.createElement('div');item.className='counter-item';
      item.innerHTML=`<img alt="${escapeHtml(target)}"><span class="name">${escapeHtml(target)}<span class="by">${cov.by.length?'by '+escapeHtml(cov.by.slice(0,2).join(', ')):'no Good+ answer'}</span></span><span class="dot t${cov.tier}" title="${TIER_LABEL[cov.tier]}"></span>`;
      bindArt(item.querySelector('img'),c);grid.appendChild(item);
    });
  }

  function renderSynergies(r){
    $('synergySummary').textContent=`${r.synergies.incredible} Incredible · ${r.synergies.greatOrBetter} Great+ · ${r.synergies.goodOrBetter} Good+`;
    const list=$('synergyList');
    if(!r.synergies.pairs.length){list.innerHTML='<div class="empty-msg">No rated synergy pairs in the current deck yet.</div>';return;}
    list.innerHTML=r.synergies.pairs.slice(0,12).map(p=>`<div class="syn-pair"><span>${escapeHtml(p.a)}</span><span class="tier t${p.tier}">${TIER_LABEL[p.tier]}</span><span>${escapeHtml(p.b)}</span></div>`).join('');
  }

  function render(){renderDeck();renderChips();renderScore();save()}

  function setBusy(on,text){$('generateBtn').disabled=on;$('improveBtn').disabled=on;$('statusLine').textContent=on?(text||'Optimizing…'):''}

  function generate(){
    const parsed=E.parseCardNames($('requiredInput').value);
    if(parsed.unknown.length){toast('Could not identify: '+parsed.unknown.join(', '));return;}
    setBusy(true,'Searching thousands of deck variations…');
    setTimeout(()=>{
      const res=E.generateBest({required:parsed.found,banned:[...state.banned],starts:32});
      if(res.error){toast(res.error);setBusy(false);return;}
      state.deck=res.deck;state.locked=new Set(parsed.found);setBusy(false);render();toast(`Best found: ${res.rating.score.toFixed(1)}%`);
    },30);
  }

  function improve(){
    if(state.deck.length!==8){toast('Fill all 8 slots first.');return;}
    setBusy(true,'Improving unlocked slots…');
    setTimeout(()=>{
      const before=E.deckMetrics(state.deck).score;
      const res=E.improveDeck(state.deck,{locked:[...state.locked],banned:[...state.banned]});
      setBusy(false);if(res.error){toast(res.error);return;}state.deck=res.deck;render();const gain=res.rating.score-before;toast(gain>.01?`Improved by ${gain.toFixed(1)} points`:'No better multi-card version found');
    },30);
  }

  function replaceDisliked(index){
    const old=state.deck[index];if(!old||state.locked.has(old))return;
    state.banned.add(old);
    const res=E.bestReplacement(state.deck,index,{locked:[...state.locked],banned:[...state.banned]});
    if(res.error){state.banned.delete(old);toast(res.error);return;}
    state.deck=res.deck;save();render();toast(`${old} → ${res.name}${res.delta>=0?` (+${res.delta.toFixed(1)})`:''}`);
  }

  function clearDeck(){state.deck=[];state.locked.clear();$('requiredInput').value='';save();render();toast('Deck cleared')}

  function openPicker(index){state.pickerIndex=index;$('pickerModal').hidden=false;$('pickerSearch').value='';$('pickerType').value='all';renderPicker();setTimeout(()=>$('pickerSearch').focus(),30)}
  function closePicker(){$('pickerModal').hidden=true;state.pickerIndex=null}
  function renderPicker(){
    const q=$('pickerSearch').value.toLowerCase().trim(),type=$('pickerType').value,current=state.deck[state.pickerIndex];
    const cards=E.PLAYABLE.filter(c=>(type==='all'||c.type===type)&&(!q||c.name.toLowerCase().includes(q))).sort((a,b)=>a.elixir-b.elixir||a.name.localeCompare(b.name));
    const grid=$('pickerGrid');grid.innerHTML='';
    cards.forEach(c=>{
      const disabled=state.deck.includes(c.name)&&c.name!==current;const btn=document.createElement('button');btn.type='button';btn.className='pick-card'+(disabled?' disabled':'');btn.disabled=disabled;btn.innerHTML=`<img alt="${escapeHtml(c.name)}"><span class="elixir-badge">${c.elixir}</span><span class="pc-name">${escapeHtml(c.name)}</span>`;bindArt(btn.querySelector('img'),c);
      btn.addEventListener('click',()=>chooseCard(c.name));grid.appendChild(btn);
    });
  }
  function chooseCard(name){
    const i=state.pickerIndex;if(i==null)return;const old=state.deck[i];
    if(E.CHAMPIONS.has(name)){
      const count=state.deck.filter((n,idx)=>idx!==i&&E.CHAMPIONS.has(n)).length;
      if(count>=D.perfect.maxChampions){toast(`Your rule allows at most ${D.perfect.maxChampions} Champions.`);return;}
    }
    if(old&&state.locked.has(old)){state.locked.delete(old);state.locked.add(name)}
    state.deck[i]=name;state.deck=state.deck.filter(Boolean);closePicker();save();render();
  }

  function wire(){
    $('generateBtn').addEventListener('click',generate);$('improveBtn').addEventListener('click',improve);$('clearBtn').addEventListener('click',clearDeck);
    $('resetExclusionsBtn').addEventListener('click',()=>{state.banned.clear();save();render();toast('Exclusions cleared')});
    $('requiredInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();generate()}});
    $('closePicker').addEventListener('click',closePicker);$('pickerModal').addEventListener('click',e=>{if(e.target===$('pickerModal'))closePicker()});
    $('pickerSearch').addEventListener('input',renderPicker);$('pickerType').addEventListener('change',renderPicker);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('pickerModal').hidden)closePicker()});
  }

  load();wire();renderTower();render();
  if(!state.deck.length){$('statusLine').textContent='Ready. Generate with no required cards for the closest possible deck to your Perfect Deck rules.'}
})();
