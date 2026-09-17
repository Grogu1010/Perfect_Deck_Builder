(function(root){
  'use strict';
  const DATA = root.DECK_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  if (!DATA) throw new Error('DECK_DATA is required before engine.js');

  const CARD_BY_NAME = new Map(DATA.cards.map(c => [c.name, c]));
  const PLAYABLE = DATA.cards.filter(c => c.type !== 'Tower Troop');
  const CHAMPIONS = new Set(DATA.champions || []);
  const TARGETS = DATA.counterTargets;
  const PERFECT = DATA.perfect;
  const MAX_TOTAL_ELIXIR = PERFECT.maxAvgElixir * 8;

  const ROLE_META = [
    ['winCon','Win-Cons'], ['airTank','Air Tank'], ['groundTank','Ground Tank'],
    ['antiAir','Anti-Air'], ['antiSwarms','Anti-Swarms'], ['building','Buildings'],
    ['smallSpell','Small Spells'], ['bigSpell','Big Spell'], ['miniTank','Mini Tanks'],
    ['spawner','Spawners'], ['staller','Staller'], ['swarm','Swarms']
  ];

  const ALIASES = {
    'pekka':'P.E.K.K.A', 'mini pekka':'Mini P.E.K.K.A', 'minipekka':'Mini P.E.K.K.A',
    'ebarbs':'Elite Barbarians', 'e barbs':'Elite Barbarians', 'rg':'Royal Giant',
    'rhogs':'Royal Hogs', 'royal hog':'Royal Hogs', 'hogs':'Royal Hogs', 'hog':'Hog Rider',
    'skarmy':'Skeleton Army', 'minion hoard':'Minion Horde', 'giant minion':'Minion Giant',
    'egolem':'Elixir Golem', 'elixer golem':'Elixir Golem', 'elixir gollum':'Elixir Golem',
    'gollum':'Golem', 'exe':'Executioner', 'nado':'Tornado', 'log':'The Log',
    'snowball':'Giant Snowball', 'gob barrel':'Goblin Barrel', 'drill':'Goblin Drill',
    'gob giant':'Goblin Giant', 'gob machine':'Goblin Machine', 'gob demolisher':'Goblin Demolisher',
    'spirit emperis':'Spirit Empress', 'spirit empress':'Spirit Empress', 'ronon':'Ronin',
    'aq':'Archer Queen', 'gk':'Golden Knight', 'sk':'Skeleton King', 'lp':'Little Prince',
    'mk':'Mega Knight', 'idrag':'Inferno Dragon', 'ewiz':'Electro Wizard', 'e wiz':'Electro Wizard'
  };

  function norm(s){
    return String(s || '').toLowerCase().replace(/[.']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  const NORM_TO_NAME = new Map(DATA.cards.map(c => [norm(c.name), c.name]));
  Object.entries(ALIASES).forEach(([k,v]) => NORM_TO_NAME.set(norm(k), v));

  function resolveCardName(input){
    const n = norm(input);
    if (!n) return null;
    if (NORM_TO_NAME.has(n)) return NORM_TO_NAME.get(n);
    const matches = DATA.cards.filter(c => norm(c.name).includes(n));
    return matches.length === 1 ? matches[0].name : null;
  }

  function parseCardNames(text){
    const chunks = String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const found = [], unknown = [];
    for (const raw of chunks){
      const name = resolveCardName(raw);
      if (name && !found.includes(name)) found.push(name);
      else if (!name) unknown.push(raw);
    }
    return {found, unknown};
  }

  function listTier(obj, target){
    if (!obj) return 0;
    if (obj.incredible && obj.incredible.includes(target)) return 3;
    if (obj.great && obj.great.includes(target)) return 2;
    if (obj.good && obj.good.includes(target)) return 1;
    return 0;
  }
  function counterTier(sourceName, targetName){
    const c = CARD_BY_NAME.get(sourceName);
    return c ? listTier(c.counters, targetName) : 0;
  }
  function synergyTier(aName,bName){
    if (!aName || !bName || aName === bName) return 0;
    const a = CARD_BY_NAME.get(aName), b = CARD_BY_NAME.get(bName);
    return Math.max(a ? listTier(a.synergy,bName) : 0, b ? listTier(b.synergy,aName) : 0);
  }

  function roleCounts(cards){
    const counts = {building:0};
    for (const [key] of ROLE_META) counts[key] = 0;
    for (const c of cards){
      if (c.type === 'Building') counts.building++;
      for (const [key] of ROLE_META){
        if (key !== 'building' && c.roles && c.roles[key]) counts[key]++;
      }
    }
    return counts;
  }

  function deckMetrics(deckNames){
    const names = (deckNames || []).filter(n => CARD_BY_NAME.has(n)).slice(0,8);
    const cards = names.map(n => CARD_BY_NAME.get(n));
    const duplicates = names.length - new Set(names).size;
    const avgElixir = cards.length ? cards.reduce((s,c)=>s+c.elixir,0)/cards.length : 0;
    const roles = roleCounts(cards);
    const championCount = names.filter(n => CHAMPIONS.has(n)).length;

    let incredibleSynergies=0, greatOrBetterSynergies=0, goodOrBetterSynergies=0;
    const synergyPairs=[];
    for (let i=0;i<names.length;i++) for (let j=i+1;j<names.length;j++){
      const tier=synergyTier(names[i],names[j]);
      if (tier>=1) goodOrBetterSynergies++;
      if (tier>=2) greatOrBetterSynergies++;
      if (tier>=3) incredibleSynergies++;
      if (tier) synergyPairs.push({a:names[i],b:names[j],tier});
    }

    const counterCoverage={};
    let incredibleCounters=0, greatOrBetterCounters=0, goodOrBetterCounters=0;
    for (const target of TARGETS){
      let bestTier=0, by=[];
      for (const source of names){
        const tier=counterTier(source,target);
        if (tier>bestTier){ bestTier=tier; by=[source]; }
        else if (tier===bestTier && tier>0) by.push(source);
      }
      counterCoverage[target]={tier:bestTier,by};
      if (bestTier>=1) goodOrBetterCounters++;
      if (bestTier>=2) greatOrBetterCounters++;
      if (bestTier>=3) incredibleCounters++;
    }

    const criteria=[];
    const pushCriterion=(id,label,value,target,progress,met,detail)=>criteria.push({id,label,value,target,progress:Math.max(0,Math.min(1,progress)),met,detail});
    pushCriterion('deckSize','8 cards',names.length,8,names.length/8,names.length===8,`${names.length}/8 cards`);
    const elixirProgress = cards.length===0 ? 0 : (avgElixir<=PERFECT.maxAvgElixir ? 1 : Math.max(0,1-(avgElixir-PERFECT.maxAvgElixir)/2));
    pushCriterion('elixir','Average Elixir ≤ 3.5',avgElixir,PERFECT.maxAvgElixir,elixirProgress,cards.length===8 && avgElixir<=PERFECT.maxAvgElixir,`${avgElixir.toFixed(2)} average`);
    pushCriterion('champions','Champions ≤ 3',championCount,PERFECT.maxChampions,championCount<=PERFECT.maxChampions?1:Math.max(0,1-(championCount-PERFECT.maxChampions)/3),championCount<=PERFECT.maxChampions,`${championCount}/${PERFECT.maxChampions} Champions`);

    for (const [key,label] of ROLE_META){
      const target=PERFECT.roles[key], value=roles[key]||0;
      pushCriterion('role:'+key,`${target} ${label}`,value,target,target?value/target:1,value>=target,`${value}/${target}`);
    }
    const s=PERFECT.synergy;
    pushCriterion('syn:inc','1 Incredible synergy',incredibleSynergies,s.incredible,incredibleSynergies/s.incredible,incredibleSynergies>=s.incredible,`${incredibleSynergies}/${s.incredible}`);
    pushCriterion('syn:great','2 Great+ synergies',greatOrBetterSynergies,s.greatOrBetter,greatOrBetterSynergies/s.greatOrBetter,greatOrBetterSynergies>=s.greatOrBetter,`${greatOrBetterSynergies}/${s.greatOrBetter}`);
    pushCriterion('syn:good','3 Good+ synergies',goodOrBetterSynergies,s.goodOrBetter,goodOrBetterSynergies/s.goodOrBetter,goodOrBetterSynergies>=s.goodOrBetter,`${goodOrBetterSynergies}/${s.goodOrBetter}`);

    const ct=PERFECT.counters;
    pushCriterion('ctr:inc','5 Incredible counters',incredibleCounters,ct.incredible,incredibleCounters/ct.incredible,incredibleCounters>=ct.incredible,`${incredibleCounters}/${ct.incredible}`);
    pushCriterion('ctr:great','10 Great+ counters',greatOrBetterCounters,ct.greatOrBetter,greatOrBetterCounters/ct.greatOrBetter,greatOrBetterCounters>=ct.greatOrBetter,`${greatOrBetterCounters}/${ct.greatOrBetter}`);
    pushCriterion('ctr:good',`${ct.goodOrBetter} Good+ counters`,goodOrBetterCounters,ct.goodOrBetter,goodOrBetterCounters/ct.goodOrBetter,goodOrBetterCounters>=ct.goodOrBetter,`${goodOrBetterCounters}/${ct.goodOrBetter}`);

    const score = criteria.reduce((s,c)=>s+c.progress,0)/criteria.length*100;
    const hardValid = duplicates===0 && championCount<=PERFECT.maxChampions && names.length===8;
    const perfect = hardValid && criteria.every(c=>c.met);
    return {
      names,cards,score,perfect,hardValid,duplicates,avgElixir,roles,championCount,
      synergies:{incredible:incredibleSynergies,greatOrBetter:greatOrBetterSynergies,goodOrBetter:goodOrBetterSynergies,pairs:synergyPairs.sort((a,b)=>b.tier-a.tier)},
      counters:{incredible:incredibleCounters,greatOrBetter:greatOrBetterCounters,goodOrBetter:goodOrBetterCounters,coverage:counterCoverage},
      criteria
    };
  }

  function objective(deckNames){
    const m=deckMetrics(deckNames);
    let v=m.score;
    if (m.names.length===8 && m.avgElixir>PERFECT.maxAvgElixir) v-=(m.avgElixir-PERFECT.maxAvgElixir)*40;
    if (m.championCount>PERFECT.maxChampions) v-=(m.championCount-PERFECT.maxChampions)*80;
    v-=m.duplicates*100;
    return v;
  }

  const TIE_ROLE_ORDER = ['winCon','airTank','groundTank','antiAir','antiSwarms','building','smallSpell','bigSpell','miniTank','spawner','staller','swarm'];
  const EPS = 1e-7;

  function tieBreakVector(deckNames){
    const m=deckMetrics(deckNames);
    const criteriaMet=m.criteria.reduce((n,c)=>n+(c.met?1:0),0);
    const roleVector=TIE_ROLE_ORDER.map(key=>Math.min(m.roles[key]||0,PERFECT.roles[key]||0));
    return [
      m.perfect?1:0,
      criteriaMet,
      m.counters.incredible,
      m.counters.greatOrBetter,
      m.counters.goodOrBetter,
      ...roleVector,
      m.synergies.incredible,
      m.synergies.greatOrBetter,
      m.synergies.goodOrBetter,
      -m.avgElixir
    ];
  }

  function compareTieBreak(aDeck,bDeck){
    const a=tieBreakVector(aDeck), b=tieBreakVector(bDeck);
    for(let i=0;i<a.length;i++){
      if(a[i]>b[i]) return 1;
      if(a[i]<b[i]) return -1;
    }
    const as=[...aDeck].sort().join('|'), bs=[...bDeck].sort().join('|');
    return as<bs?1:as>bs?-1:0;
  }

  function isBetterDeck(candidate,candidateObj,current,currentObj){
    if(!current) return true;
    if(candidateObj>currentObj+EPS) return true;
    if(candidateObj<currentObj-EPS) return false;
    return compareTieBreak(candidate,current)>0;
  }

  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }

  function currentCounterTiers(deck){
    const out={};
    for(const t of TARGETS){ let b=0; for(const n of deck) b=Math.max(b,counterTier(n,t)); out[t]=b; }
    return out;
  }

  function marginalUtility(deck, card){
    if (deck.includes(card.name)) return -Infinity;
    const currentCards=deck.map(n=>CARD_BY_NAME.get(n));
    const counts=roleCounts(currentCards);
    let u=0;
    for(const [key] of ROLE_META){
      const target=PERFECT.roles[key];
      const has= key==='building' ? card.type==='Building' : !!card.roles[key];
      if(has && counts[key]<target) u += 7/Math.max(1,target);
    }
    const tiers=currentCounterTiers(deck);
    for(const t of TARGETS){
      const before=tiers[t], after=Math.max(before,counterTier(card.name,t));
      if(after>before) u += (after===3?1.0:after===2?0.62:0.28);
    }
    for(const n of deck){ const tier=synergyTier(n,card.name); u += tier===3?2.4:tier===2?1.25:tier===1?0.55:0; }
    u += Math.max(-1.5,(3.5-card.elixir)*0.45);
    if(CHAMPIONS.has(card.name) && deck.filter(n=>CHAMPIONS.has(n)).length>=PERFECT.maxChampions) return -Infinity;
    return u;
  }

  function projectedBudgetPenalty(deck, candidate, bannedSet){
    const used=new Set(deck); used.add(candidate.name);
    const remaining=8-used.size;
    if(remaining<=0) return 0;
    const pool=PLAYABLE.filter(c=>!used.has(c.name)&&!bannedSet.has(c.name)).map(c=>c.elixir).sort((a,b)=>a-b);
    const minTail=pool.slice(0,remaining).reduce((a,b)=>a+b,0);
    const total=deck.reduce((s,n)=>s+CARD_BY_NAME.get(n).elixir,0)+candidate.elixir+minTail;
    return Math.max(0,total-MAX_TOTAL_ELIXIR)*4;
  }

  function makeSeed(required,bannedSet,rng){
    const deck=[...required];
    while(deck.length<8){
      let candidates=PLAYABLE.filter(c=>!deck.includes(c.name)&&!bannedSet.has(c.name));
      candidates=candidates.map(c=>({c,score:marginalUtility(deck,c)-projectedBudgetPenalty(deck,c,bannedSet)+(rng()-0.5)*1.8}))
        .filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score);
      if(!candidates.length) break;
      const top=candidates.slice(0,Math.min(14,candidates.length));
      const pick=Math.min(top.length-1,Math.floor(Math.pow(rng(),2)*top.length));
      deck.push(top[pick].c.name);
    }
    return deck;
  }

  function optimizeDeck(seed, lockedSet, bannedSet, maxPasses=5){
    let deck=[...seed].slice(0,8);
    if(deck.length<8) return deck;
    let bestObj=objective(deck);
    for(let pass=0;pass<maxPasses;pass++){
      let changed=false;
      for(let i=0;i<deck.length;i++){
        if(lockedSet.has(deck[i])) continue;
        const old=deck[i];
        let bestName=old, localBest=bestObj;
        for(const c of PLAYABLE){
          if(c.name===old || bannedSet.has(c.name) || deck.includes(c.name)) continue;
          const next=[...deck]; next[i]=c.name;
          if(next.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) continue;
          const o=objective(next);
          if(isBetterDeck(next,o,deck.map((n,k)=>k===i?bestName:n),localBest)){ localBest=o; bestName=c.name; }
        }
        if(bestName!==old){ deck[i]=bestName; bestObj=localBest; changed=true; }
      }
      if(!changed) break;
    }
    return deck;
  }

  function validateConstraints(required,banned){
    const req=[...new Set((required||[]).filter(n=>CARD_BY_NAME.has(n)&&CARD_BY_NAME.get(n).type!=='Tower Troop'))];
    const ban=new Set((banned||[]).filter(n=>CARD_BY_NAME.has(n)));
    if(req.length>8) return {ok:false,error:'You can require at most 8 cards.'};
    const overlap=req.filter(n=>ban.has(n));
    if(overlap.length) return {ok:false,error:`Required and excluded at the same time: ${overlap.join(', ')}`};
    if(req.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) return {ok:false,error:`Your rule allows at most ${PERFECT.maxChampions} Champions.`};
    if(PLAYABLE.filter(c=>!ban.has(c.name)).length<8) return {ok:false,error:'Too many cards are excluded to make a deck.'};
    return {ok:true,required:req,banned:ban};
  }

  function pairImprove(seed, lockedSet, bannedSet, passes=2){
    let deck=[...seed], bestObj=objective(deck);
    for(let pass=0;pass<passes;pass++){
      let bestDeck=null, passBest=bestObj;
      const idxs=deck.map((n,i)=>lockedSet.has(n)?-1:i).filter(i=>i>=0);
      for(let a=0;a<idxs.length;a++) for(let b=a+1;b<idxs.length;b++){
        const i=idxs[a], j=idxs[b];
        const base=deck.filter((_,k)=>k!==i&&k!==j);
        const pool=PLAYABLE.filter(c=>!base.includes(c.name)&&!bannedSet.has(c.name))
          .map(c=>({c,u:marginalUtility(base,c)})).filter(x=>Number.isFinite(x.u))
          .sort((x,y)=>y.u-x.u).slice(0,24).map(x=>x.c);
        for(let x=0;x<pool.length;x++) for(let y=x+1;y<pool.length;y++){
          const c1=pool[x], c2=pool[y];
          const next=[...deck]; next[i]=c1.name; next[j]=c2.name;
          if(new Set(next).size!==8) continue;
          if(next.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) continue;
          const o=objective(next);
          if(isBetterDeck(next,o,bestDeck||deck,passBest)){ passBest=o; bestDeck=next; }
        }
      }
      if(!bestDeck) break;
      deck=optimizeDeck(bestDeck,lockedSet,bannedSet,5); bestObj=objective(deck);
    }
    return deck;
  }

  function generateBest(opts={}){
    const val=validateConstraints(opts.required||[],opts.banned||[]);
    if(!val.ok) return {error:val.error};
    const required=val.required, banned=val.banned, locked=new Set(required);
    let best=null, bestObj=-Infinity;
    const starts=Math.max(8,Math.min(40,opts.starts||22));
    for(let i=0;i<starts;i++){
      const rng=mulberry32(1337+i*7919+required.join('|').length*97+banned.size*31);
      let seed=makeSeed(required,banned,rng);
      if(seed.length<8) continue;
      seed=optimizeDeck(seed,locked,banned,6);
      const o=objective(seed);
      if(isBetterDeck(seed,o,best,bestObj)){bestObj=o;best=seed;}
      if(deckMetrics(seed).perfect) break;
    }
    if(!best) return {error:'Could not build a valid 8-card deck with those restrictions.'};
    best=pairImprove(best,locked,banned,2); bestObj=objective(best);
    return {deck:best,rating:deckMetrics(best),specials:autoSpecials(best),objective:bestObj};
  }

  function generateTopDecks(opts={}){
    const val=validateConstraints(opts.required||[],opts.banned||[]);
    if(!val.ok) return {error:val.error};
    const required=val.required, banned=val.banned, locked=new Set(required);
    const limit=Math.max(1,Math.min(30,opts.limit||15));
    const starts=Math.max(24,Math.min(96,opts.starts||56));
    const ranked=new Map();

    const addDeck=deck=>{
      if(!deck || deck.length!==8 || new Set(deck).size!==8) return;
      if(deck.some(n=>banned.has(n))) return;
      if(required.some(n=>!deck.includes(n))) return;
      if(deck.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) return;
      const key=[...deck].sort().join('|');
      const obj=objective(deck);
      const prev=ranked.get(key);
      if(!prev || isBetterDeck(deck,obj,prev.deck,prev.objective)) ranked.set(key,{deck:[...deck],objective:obj});
    };
    const sorter=(a,b)=>{
      if(Math.abs(a.objective-b.objective)>EPS) return b.objective-a.objective;
      return -compareTieBreak(a.deck,b.deck);
    };

    for(let i=0;i<starts;i++){
      const rng=mulberry32(424242+i*104729+required.join('|').length*97+banned.size*31);
      let seed=makeSeed(required,banned,rng);
      if(seed.length<8) continue;
      seed=optimizeDeck(seed,locked,banned,4);
      addDeck(seed);
    }

    // Add high-quality one-card neighbours so the list stays useful and varied
    // even when several randomized searches converge on the same optimum.
    const bases=[...ranked.values()].sort(sorter).slice(0,4);
    for(const base of bases){
      const names=base.deck;
      for(let i=0;i<8;i++){
        if(locked.has(names[i])) continue;
        for(const card of PLAYABLE){
          if(card.name===names[i] || banned.has(card.name) || names.includes(card.name)) continue;
          const next=[...names]; next[i]=card.name;
          addDeck(next);
        }
      }
    }

    const decks=[...ranked.values()].sort(sorter).slice(0,limit).map((item,index)=>({
      rank:index+1,
      deck:item.deck,
      rating:deckMetrics(item.deck),
      specials:autoSpecials(item.deck),
      objective:item.objective
    }));
    if(!decks.length) return {error:'Could not rank valid decks with those restrictions.'};
    return {decks};
  }

  function improveDeck(deck, opts={}){
    const names=(deck||[]).filter(n=>CARD_BY_NAME.has(n));
    if(names.length!==8) return {error:'Fill all 8 deck slots before improving the deck.'};
    const banned=new Set(opts.banned||[]), locked=new Set(opts.locked||[]);
    let best=optimizeDeck(names,locked,banned,8), bestObj=objective(best);
    const unlockedIdx=names.map((n,i)=>locked.has(n)?-1:i).filter(i=>i>=0);
    for(let s=0;s<8;s++){
      if(!unlockedIdx.length) break;
      const rng=mulberry32(9001+s*1237);
      let seed=[...names];
      const mutations=Math.min(unlockedIdx.length,1+(s%2));
      for(let m=0;m<mutations;m++){
        const idx=unlockedIdx[Math.floor(rng()*unlockedIdx.length)];
        const pool=PLAYABLE.filter(c=>!seed.includes(c.name)&&!banned.has(c.name));
        if(pool.length) seed[idx]=pool[Math.floor(rng()*pool.length)].name;
      }
      seed=optimizeDeck(seed,locked,banned,6);
      const o=objective(seed); if(isBetterDeck(seed,o,best,bestObj)){best=seed;bestObj=o;}
    }
    return {deck:best,rating:deckMetrics(best),specials:autoSpecials(best),objective:bestObj};
  }

  function bestReplacement(deck,index,opts={}){
    const names=[...(deck||[])];
    if(names.length!==8 || index<0 || index>=8) return {error:'A complete 8-card deck is required.'};
    const locked=new Set(opts.locked||[]), banned=new Set(opts.banned||[]);
    if(locked.has(names[index])) return {error:`${names[index]} is locked.`};
    const old=names[index];
    let best=null,bestObj=-Infinity;
    for(const c of PLAYABLE){
      if(c.name===old || banned.has(c.name) || names.includes(c.name)) continue;
      const next=[...names]; next[index]=c.name;
      if(next.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) continue;
      const o=objective(next);
      if(!best || isBetterDeck(next,o,best.deck,bestObj)){bestObj=o;best={name:c.name,deck:next,rating:deckMetrics(next),objective:o};}
    }
    if(!best) return {error:'No legal replacement found.'};
    best.delta=best.rating.score-deckMetrics(names).score;
    return best;
  }

  function topSwapSuggestions(deck,opts={}){
    const names=[...(deck||[])];
    if(names.length!==8) return [];
    const locked=new Set(opts.locked||[]), banned=new Set(opts.banned||[]);
    const base=deckMetrics(names), suggestions=[];
    for(let i=0;i<8;i++){
      if(locked.has(names[i])) continue;
      const old=names[i];
      for(const c of PLAYABLE){
        if(c.name===old || banned.has(c.name) || names.includes(c.name)) continue;
        const next=[...names]; next[i]=c.name;
        if(next.filter(n=>CHAMPIONS.has(n)).length>PERFECT.maxChampions) continue;
        const r=deckMetrics(next);
        const delta=r.score-base.score;
        if(delta>0.02) suggestions.push({index:i,out:old,in:c.name,delta,score:r.score,deck:next});
      }
    }
    suggestions.sort((a,b)=>b.score-a.score || b.delta-a.delta || -compareTieBreak(a.deck,b.deck));
    const seen=new Set(), out=[];
    for(const s of suggestions){
      const key=s.out+'>'+s.in; if(seen.has(key)) continue; seen.add(key); out.push(s); if(out.length>=Math.min(6,opts.limit||4)) break;
    }
    return out;
  }

  function cardImportance(name,deck){
    const c=CARD_BY_NAME.get(name); if(!c) return 0;
    let x=0;
    for(const [key] of ROLE_META){ if(key==='building' ? c.type==='Building' : c.roles[key]) x+=1; }
    for(const n of deck) if(n!==name) x+=synergyTier(name,n)*0.7;
    for(const t of TARGETS) x+=counterTier(name,t)*0.08;
    return x;
  }

  function autoSpecials(deck){
    const names=(deck||[]).filter(n=>CARD_BY_NAME.has(n));
    const used=new Set();
    const sortByImportance=arr=>[...arr].sort((a,b)=>cardImportance(b,names)-cardImportance(a,names));
    const champs=sortByImportance(names.filter(n=>CHAMPIONS.has(n)));
    const heroEligible=sortByImportance(names.filter(n=>CARD_BY_NAME.get(n).hasHero && !CHAMPIONS.has(n)));
    const evoEligible=sortByImportance(names.filter(n=>CARD_BY_NAME.get(n).hasEvo));
    let heroSlot=null,evoSlot=null,wildSlot=null,wildType=null;
    const heroPool=[...champs,...heroEligible];
    heroSlot=heroPool.find(n=>!used.has(n))||null; if(heroSlot) used.add(heroSlot);
    evoSlot=evoEligible.find(n=>!used.has(n))||null; if(evoSlot) used.add(evoSlot);
    const wildHero=[...champs,...heroEligible].find(n=>!used.has(n));
    const wildEvo=evoEligible.find(n=>!used.has(n));
    if(wildHero && wildEvo){
      wildSlot=cardImportance(wildHero,names)>=cardImportance(wildEvo,names)?wildHero:wildEvo;
      wildType=wildSlot===wildHero?'Hero/Champion':'Evolution';
    } else if(wildHero){wildSlot=wildHero;wildType='Hero/Champion';}
    else if(wildEvo){wildSlot=wildEvo;wildType='Evolution';}
    return {evoSlot,heroSlot,wildSlot,wildType,champions:champs};
  }

  function explainDeck(deck,opts={}){
    const r=deckMetrics(deck), notes=[];
    if(r.names.length<8) notes.push({kind:'bad',text:`Add ${8-r.names.length} more card${8-r.names.length===1?'':'s'} to review a full deck.`});
    if(r.avgElixir>PERFECT.maxAvgElixir) notes.push({kind:'bad',text:`Average Elixir is ${r.avgElixir.toFixed(2)}. Cut ${(r.avgElixir-PERFECT.maxAvgElixir).toFixed(2)} or more to reach the 3.5 cap.`});
    if(r.championCount>PERFECT.maxChampions) notes.push({kind:'bad',text:`Too many Champions: ${r.championCount}. Your limit is ${PERFECT.maxChampions}.`});
    for(const [key,label] of ROLE_META){
      const target=PERFECT.roles[key], value=r.roles[key]||0;
      if(value<target) notes.push({kind:'warn',text:`Needs ${target-value} more ${label} (${value}/${target}).`});
    }
    if(r.synergies.incredible<PERFECT.synergy.incredible) notes.push({kind:'warn',text:'Needs at least one Incredible card-to-card synergy.'});
    if(r.synergies.greatOrBetter<PERFECT.synergy.greatOrBetter) notes.push({kind:'warn',text:`Needs ${PERFECT.synergy.greatOrBetter-r.synergies.greatOrBetter} more Great-or-better synergy pair.`});
    if(r.synergies.goodOrBetter<PERFECT.synergy.goodOrBetter) notes.push({kind:'warn',text:`Needs ${PERFECT.synergy.goodOrBetter-r.synergies.goodOrBetter} more Good-or-better synergy pair.`});
    const uncovered=TARGETS.filter(t=>r.counters.coverage[t].tier===0);
    const onlyGood=TARGETS.filter(t=>r.counters.coverage[t].tier===1);
    const onlyGreat=TARGETS.filter(t=>r.counters.coverage[t].tier===2);
    if(uncovered.length) notes.push({kind:'bad',text:`No Good+ answer yet for: ${uncovered.slice(0,8).join(', ')}${uncovered.length>8?` +${uncovered.length-8} more`:''}.`});
    if(r.counters.incredible<PERFECT.counters.incredible) notes.push({kind:'warn',text:`Needs ${PERFECT.counters.incredible-r.counters.incredible} more priority matchup at Incredible counter strength.`});
    if(r.counters.greatOrBetter<PERFECT.counters.greatOrBetter) notes.push({kind:'warn',text:`Needs ${PERFECT.counters.greatOrBetter-r.counters.greatOrBetter} more priority matchup at Great+ counter strength.`});
    if(!notes.length && r.perfect) notes.push({kind:'good',text:'This deck hits every Perfect Deck target.'});
    else if(!notes.length) notes.push({kind:'good',text:'No obvious structural weakness found.'});
    return {rating:r,notes,uncovered,onlyGood,onlyGreat,swaps:topSwapSuggestions(deck,opts)};
  }

  const API={DATA,CARD_BY_NAME,PLAYABLE,CHAMPIONS,ROLE_META,resolveCardName,parseCardNames,counterTier,synergyTier,deckMetrics,objective,tieBreakVector,compareTieBreak,generateBest,generateTopDecks,improveDeck,bestReplacement,topSwapSuggestions,autoSpecials,explainDeck};
  root.DeckEngine=API;
  if(typeof module!=='undefined'&&module.exports) module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
