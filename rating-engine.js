(function(root){
  'use strict';
  const E=root.DeckEngine, D=root.DECK_DATA;
  if(!E||!D) throw new Error('DeckEngine and DECK_DATA are required before rating-engine.js');
  const P=D.perfect, EPS=1e-7;
  const original={deckMetrics:E.deckMetrics,generateBest:E.generateBest,improveDeck:E.improveDeck,explainDeck:E.explainDeck,autoSpecials:E.autoSpecials};

  function deckMetrics(deck){
    const base=original.deckMetrics(deck);
    const avg=base.cards.length?base.cards.reduce((s,c)=>s+(Number(c.rating)||0),0)/base.cards.length:0;
    const criterion={id:'cardRating',label:`Average card rating ≥ ${P.minAvgRating.toFixed(1)}/10`,value:avg,target:P.minAvgRating,progress:Math.max(0,Math.min(1,base.cards.length?avg/P.minAvgRating:0)),met:base.names.length===8&&avg>=P.minAvgRating,detail:`${avg.toFixed(2)}/10 average`};
    const criteria=base.criteria.filter(c=>c.id!=='cardRating');
    const elixirIndex=criteria.findIndex(c=>c.id==='elixir');
    criteria.splice(elixirIndex>=0?elixirIndex+1:1,0,criterion);
    const score=criteria.reduce((s,c)=>s+c.progress,0)/criteria.length*100;
    const perfect=base.hardValid&&criteria.every(c=>c.met);
    return {...base,avgCardRating:avg,criteria,score,perfect};
  }

  function objective(deck){
    const m=deckMetrics(deck); let v=m.score;
    if(m.names.length===8&&m.avgElixir>P.maxAvgElixir) v-=(m.avgElixir-P.maxAvgElixir)*40;
    if(m.championCount>P.maxChampions) v-=(m.championCount-P.maxChampions)*80;
    v-=m.duplicates*100;
    return v;
  }

  function compare(a,b){
    const ma=deckMetrics(a), mb=deckMetrics(b);
    const va=objective(a), vb=objective(b);
    if(va>vb+EPS) return 1; if(va<vb-EPS) return -1;
    const ca=ma.criteria.reduce((n,c)=>n+(c.met?1:0),0), cb=mb.criteria.reduce((n,c)=>n+(c.met?1:0),0);
    if(ca!==cb) return ca>cb?1:-1;
    const numsA=[ma.counters.incredible,ma.counters.greatOrBetter,ma.counters.goodOrBetter,ma.synergies.incredible,ma.synergies.greatOrBetter,ma.synergies.goodOrBetter,ma.avgCardRating,-ma.avgElixir];
    const numsB=[mb.counters.incredible,mb.counters.greatOrBetter,mb.counters.goodOrBetter,mb.synergies.incredible,mb.synergies.greatOrBetter,mb.synergies.goodOrBetter,mb.avgCardRating,-mb.avgElixir];
    for(let i=0;i<numsA.length;i++){if(numsA[i]!==numsB[i]) return numsA[i]>numsB[i]?1:-1;}
    return 0;
  }

  function optimize(seed,locked,banned,passes=7){
    let deck=[...seed], best=objective(deck);
    if(deck.length!==8) return deck;
    for(let pass=0;pass<passes;pass++){
      let changed=false;
      for(let i=0;i<8;i++){
        if(locked.has(deck[i])) continue;
        const old=deck[i]; let bestName=old, bestDeck=[...deck], local=best;
        for(const c of E.PLAYABLE){
          if(c.name===old||banned.has(c.name)||deck.includes(c.name)) continue;
          const next=[...deck]; next[i]=c.name;
          if(next.filter(n=>E.CHAMPIONS.has(n)).length>P.maxChampions) continue;
          const o=objective(next);
          if(o>local+EPS||(Math.abs(o-local)<=EPS&&compare(next,bestDeck)>0)){local=o;bestName=c.name;bestDeck=next;}
        }
        if(bestName!==old){deck=bestDeck;best=local;changed=true;}
      }
      if(!changed) break;
    }
    return deck;
  }

  function resultFor(deck){return {deck,rating:deckMetrics(deck),specials:original.autoSpecials(deck),objective:objective(deck)};}

  function generateBest(opts={}){
    const base=original.generateBest(opts); if(base.error) return base;
    const locked=new Set(opts.required||[]), banned=new Set(opts.banned||[]);
    let best=optimize(base.deck,locked,banned,8);
    const high=[...E.PLAYABLE].filter(c=>!banned.has(c.name)).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,18);
    for(let i=0;i<best.length;i++){
      if(locked.has(best[i])) continue;
      for(const c of high.slice(0,6)){
        if(best.includes(c.name)) continue;
        const seed=[...best]; seed[i]=c.name;
        const candidate=optimize(seed,locked,banned,5);
        if(compare(candidate,best)>0) best=candidate;
      }
    }
    return resultFor(best);
  }

  function improveDeck(deck,opts={}){
    const names=(deck||[]).filter(n=>E.CARD_BY_NAME.has(n));
    if(names.length!==8) return {error:'Fill all 8 deck slots before improving the deck.'};
    const locked=new Set(opts.locked||[]), banned=new Set(opts.banned||[]);
    return resultFor(optimize(names,locked,banned,10));
  }

  function bestReplacement(deck,index,opts={}){
    const names=[...(deck||[])];
    if(names.length!==8||index<0||index>=8) return {error:'A complete 8-card deck is required.'};
    const locked=new Set(opts.locked||[]), banned=new Set(opts.banned||[]), old=names[index];
    if(locked.has(old)) return {error:`${old} is locked.`};
    let best=null;
    for(const c of E.PLAYABLE){
      if(c.name===old||banned.has(c.name)||names.includes(c.name)) continue;
      const next=[...names]; next[index]=c.name;
      if(next.filter(n=>E.CHAMPIONS.has(n)).length>P.maxChampions) continue;
      if(!best||compare(next,best.deck)>0) best={name:c.name,deck:next};
    }
    if(!best) return {error:'No legal replacement found.'};
    best.rating=deckMetrics(best.deck); best.objective=objective(best.deck); best.delta=best.rating.score-deckMetrics(names).score; return best;
  }

  function topSwapSuggestions(deck,opts={}){
    const names=[...(deck||[])]; if(names.length!==8) return [];
    const locked=new Set(opts.locked||[]), banned=new Set(opts.banned||[]), base=deckMetrics(names), out=[];
    for(let i=0;i<8;i++){
      if(locked.has(names[i])) continue;
      for(const c of E.PLAYABLE){
        if(c.name===names[i]||banned.has(c.name)||names.includes(c.name)) continue;
        const next=[...names]; next[i]=c.name;
        if(next.filter(n=>E.CHAMPIONS.has(n)).length>P.maxChampions) continue;
        const r=deckMetrics(next), delta=r.score-base.score;
        if(delta>0.02) out.push({index:i,out:names[i],in:c.name,delta,score:r.score,deck:next});
      }
    }
    out.sort((a,b)=>compare(b.deck,a.deck));
    const seen=new Set(); return out.filter(s=>{const k=s.out+'>'+s.in;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,Math.min(6,opts.limit||4));
  }

  function explainDeck(deck,opts={}){
    const base=original.explainDeck(deck,opts), r=deckMetrics(deck);
    let notes=[...base.notes];
    if(r.names.length===8&&r.avgCardRating<P.minAvgRating){
      notes=notes.filter(n=>n.kind!=='good');
      notes.unshift({kind:'bad',text:`Average card rating is ${r.avgCardRating.toFixed(2)}/10. Raise it by ${(P.minAvgRating-r.avgCardRating).toFixed(2)} to reach ${P.minAvgRating.toFixed(1)}/10.`});
    }
    if(!notes.length&&r.perfect) notes.push({kind:'good',text:'This deck hits every Perfect Deck target.'});
    return {...base,rating:r,notes,swaps:topSwapSuggestions(deck,opts)};
  }

  E.deckMetrics=deckMetrics; E.objective=objective; E.generateBest=generateBest; E.improveDeck=improveDeck;
  E.bestReplacement=bestReplacement; E.topSwapSuggestions=topSwapSuggestions; E.explainDeck=explainDeck;
})(globalThis);
