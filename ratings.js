(function(root){
  'use strict';
  const D=root.DECK_DATA;
  if(!D) throw new Error('DECK_DATA is required before ratings.js');
  const RATINGS={"Archer Queen":7,"Archers":4,"Arrows":6,"Baby Dragon":8,"Balloon":8,"Bandit":6,"Barbarian Barrel":4,"Barbarian Hut":2.5,"Barbarians":5,"Bats":7.5,"Battle Healer":7.7,"Battle Ram":8.5,"Berserker":6,"Bomb Tower":6,"Bomber":4,"Boss Bandit":7,"Bowler":7,"Cannon":8,"Cannon Cart":6.7,"Cannoneer":4,"Clone":6,"Dagger Duchess":5,"Dark Prince":7,"Dart Goblin":8.5,"Earthquake":8,"Electro Dragon":7,"Electro Giant":8.5,"Electro Spirit":6,"Electro Wizard":6,"Elite Barbarians":9,"Elixir Collector":5,"Elixir Golem":8.5,"Executioner":8,"Fire Spirit":6,"Fireball":8,"Firecracker":8,"Fisherman":5,"Flying Machine":9,"Freeze":9,"Furnace":7,"Giant":4,"Giant Skeleton":8,"Giant Snowball":9,"Goblin Barrel":8.5,"Goblin Cage":8.7,"Goblin Curse":6,"Goblin Demolisher":6,"Goblin Drill":7,"Goblin Gang":9,"Goblin Giant":5.5,"Goblin Hut":6,"Goblin Machine":7,"Goblins":5,"Goblinstein":7.5,"Golden Knight":7,"Golem":5,"Graveyard":9.5,"Guards":9.5,"Heal Spirit":3,"Hog Rider":8,"Hunter":8,"Ice Golem":8.5,"Ice Spirit":7,"Ice Wizard":8,"Inferno Dragon":9,"Inferno Tower":9,"Knight":6,"Lava Hound":6,"Lightning":8.5,"Little Prince":4,"Lumberjack":7.5,"Magic Archer":9,"Mega Knight":9,"Mega Minion":8.5,"Mighty Miner":7,"Miner":7.5,"Mini P.E.K.K.A":10,"Minion Giant":6.5,"Minion Horde":10,"Minions":7,"Mirror":7,"Monk":8,"Mortar":8.5,"Mother Witch":6,"Musketeer":6,"Night Witch":8.5,"P.E.K.K.A":10,"Phoenix":7.5,"Poison":9,"Prince":7,"Princess":10,"Rage":8,"Ram Rider":9.5,"Rascals":8,"Rocket":9,"Ronin":10,"Royal Chef":6,"Royal Delivery":8.5,"Royal Ghost":8,"Royal Giant":8.5,"Royal Hogs":8.5,"Royal Recruits":10,"Rune Giant":4,"Skeleton Army":8.5,"Skeleton Barrel":9,"Skeleton Dragons":10,"Skeleton King":8.5,"Skeletons":10,"Sparky":7.5,"Spear Goblins":5.5,"Spirit Empress":8,"Suspicious Bush":8,"Tesla":2,"The Log":7,"Three Musketeers":5,"Tombstone":10,"Tornado":10,"Tower Princess":9,"Valkyrie":9,"Vines":8.5,"Void":7,"Wall Breakers":8,"Witch":8.5,"Wizard":6,"X-Bow":7,"Zap":4,"Zappies":9.5};
  D.version='4.0.0';
  D.perfect.minAvgRating=7.8;
  const tie=D.perfect.tieBreakPriority||[];
  if(!tie.includes('Higher average card rating')){
    const i=tie.indexOf('Lower average Elixir');
    tie.splice(i>=0?i:tie.length,0,'Higher average card rating');
  }
  for(const card of D.cards){
    if(!Object.prototype.hasOwnProperty.call(RATINGS,card.name)) throw new Error('Missing personal rating for '+card.name);
    card.rating=RATINGS[card.name];
  }
  root.CARD_RATINGS=Object.freeze(RATINGS);
})(globalThis);
