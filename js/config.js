'use strict';
/* =====================================================
STRONGHOLD SIEGE -- js/config.js
All game constants, data tables, map blueprint
===================================================== */

// -- Canvas / Isometric ------------------------------
const TILE_W  = 52;   // width of isometric tile diamond
const TILE_H  = 26;   // height of isometric tile diamond
const MAP_W   = 17;
const MAP_H   = 17;

// These are set at runtime by main.js to allow responsive layout
let OX = 500;   // isometric origin X (screen)
let OY = 78;    // isometric origin Y (screen)

// Convert tile coords -> screen coords (top point of tile)
function toSc(tx, ty) {
return {
x: OX + (tx - ty) * TILE_W / 2,
y: OY + (tx + ty) * TILE_H / 2
};
}
// Convert screen -> tile (approximate, for hit testing)
function toTile(sx, sy) {
const rx = sx - OX;
const ry = sy - OY;
return {
tx: Math.round( rx / TILE_W + ry / TILE_H ),
ty: Math.round( ry / TILE_H - rx / TILE_W )
};
}

// -- Tile Types --------------------------------------
const T = { GRASS:0, FOREST:1, PATH:2, COURTYARD:3, ROCKY:4 };

const TILE_COL = {
[T.GRASS]:     { top:'#6b8e48', r:'#4e6e30', l:'#3d5a22' },
[T.FOREST]:    { top:'#3d5e28', r:'#2a4218', l:'#1e3010' },
[T.PATH]:      { top:'#c4a870', r:'#a08850', l:'#886838' },
[T.COURTYARD]: { top:'#d4b880', r:'#b09860', l:'#907848' },
[T.ROCKY]:     { top:'#9a9080', r:'#7a7060', l:'#606048' },
};

// -- Map Blueprint 17*17 ------------------------------
// Outer ring: grass/forest. Castle walls rows 4-12, cols 4-12.
// Towers at corners. Gate south-center at (8,12).
// Paths: north-south spine (col 8), east-west cross (row 8).
function buildMap() {
const g = T.GRASS, f = T.FOREST, p = T.PATH, c = T.COURTYARD, r = T.ROCKY;
// prettier-ignore
return [
[f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f], // 0
[f,f,r,g,g,g,g,g,g,g,g,g,g,g,r,f,f], // 1
[f,g,g,g,g,g,g,g,g,g,g,g,g,g,g,g,f], // 2
[f,g,g,g,g,g,g,g,p,g,g,g,g,g,g,g,f], // 3
[f,g,g,g,g,g,g,g,p,g,g,g,g,g,g,g,f], // 4 -- north wall row
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 5
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 6
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 7
[f,g,p,p,p,p,p,p,c,p,p,p,p,p,p,g,f], // 8 -- east-west path
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 9
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 10
[f,g,g,g,c,c,c,c,c,c,c,c,c,g,g,g,f], // 11
[f,g,g,g,g,g,g,g,p,g,g,g,g,g,g,g,f], // 12 -- south wall row
[f,g,g,g,g,g,g,g,p,g,g,g,g,g,g,g,f], // 13
[f,g,g,g,g,g,g,g,p,g,g,g,g,g,g,g,f], // 14
[f,f,g,g,g,g,g,g,p,g,g,g,g,g,f,f,f], // 15
[f,f,f,f,f,f,f,f,p,f,f,f,f,f,f,f,f], // 16 -- spawn row
];
}

// -- Building Definitions ----------------------------
const BDEF = {
WOODCUTTER: {
name:'Holzfäller-Hütte', icon:'🪓', category:'production',
produces:'rawWood', baseOutput:0.35, outputPerLvl:0.25,
baseCost:50, maxLvl:5, baseHp:160, hpPerLvl:50, canBurn:true,
col:{ top:'#9B6840', r:'#7B4820', l:'#6B3810' },
depth:22, w:1, h:1,
},
QUARRY: {
name:'Steinbruch', icon:'⛏', category:'production',
produces:'rawStone', baseOutput:0.22, outputPerLvl:0.18,
baseCost:75, maxLvl:5, baseHp:220, hpPerLvl:60, canBurn:false,
col:{ top:'#a09080', r:'#807060', l:'#706050' },
depth:18, w:1, h:1,
},
FARM: {
name:'Bauernhof', icon:'🌾', category:'production',
produces:'food', baseOutput:0.65, outputPerLvl:0.45,
baseCost:40, maxLvl:5, baseHp:130, hpPerLvl:40, canBurn:true,
col:{ top:'#c4a030', r:'#a48010', l:'#846000' },
depth:14, w:1, h:1,
},
SAWMILL: {
name:'Sägewerk', icon:'🪚', category:'refinery',
input:{ rawWood:3 }, output:{ lumber:1 }, procTime:4,
baseCost:100, maxLvl:5, baseHp:190, hpPerLvl:55, canBurn:true,
col:{ top:'#7B5030', r:'#5B3010', l:'#4B2000' },
depth:26, w:1, h:1,
},
STONEMASON: {
name:'Steinmetz-Hof', icon:'🏗', category:'refinery',
input:{ rawStone:2 }, output:{ stoneBlock:1 }, procTime:6,
baseCost:120, maxLvl:5, baseHp:240, hpPerLvl:65, canBurn:false,
col:{ top:'#7a7068', r:'#5a5048', l:'#4a4038' },
depth:24, w:1, h:1,
},
GREAT_HALL: {
name:'Große Halle', icon:'🏰', category:'special',
produces:'gold', baseOutput:0.08, outputPerLvl:0.04,
baseCost:300, maxLvl:5, baseHp:500, hpPerLvl:120, canBurn:false,
col:{ top:'#9B7B2B', r:'#7B5B0B', l:'#5B3B00' },
depth:38, w:1, h:1,
},
STORAGE: {
name:'Vorrats-Lager', icon:'📦', category:'logistics',
storageBonus:50, cartBonus:1,
baseCost:80, maxLvl:5, baseHp:200, hpPerLvl:50, canBurn:true,
col:{ top:'#b09060', r:'#907040', l:'#705020' },
depth:20, w:1, h:1,
},
TOWER: {
name:'Holzturm', icon:'🗼', category:'defense',
dps:6, dpsPerLvl:7, range:3.8, rangePerLvl:0.4,
baseCost:60, maxLvl:5, baseHp:200, hpPerLvl:90, canBurn:true,
repairRes:'lumber', repairAmt:2,
col:{ top:'#9B7050', r:'#7B5030', l:'#5B3010' },
depth:48, w:1, h:1,
},
WALL: {
name:'Mauer-Segment', icon:'🧱', category:'defense',
dps:0, baseCost:30, maxLvl:3, baseHp:500, hpPerLvl:200, canBurn:false,
repairRes:'stoneBlock', repairAmt:2,
col:{ top:'#989080', r:'#787060', l:'#686050' },
depth:30, w:1, h:1,
},
GATE: {
name:'Burgtor', icon:'🚪', category:'defense',
dps:0, baseCost:150, maxLvl:3, baseHp:1200, hpPerLvl:300, canBurn:false,
repairRes:'stoneBlock', repairAmt:4,
isGate:true,
col:{ top:'#6a6058', r:'#4a4038', l:'#3a3028' },
depth:42, w:1, h:1,
},
};

// Upgrade cost formula: C(L) = baseCost * 1.15^L
function upgradeCost(type, level) {
const base = BDEF[type].baseCost;
return Math.floor(base * Math.pow(1.15, level));
}
// Resource cost for upgrade (gold + refined materials)
function upgradeResources(type, level) {
const gold = upgradeCost(type, level);
const def  = BDEF[type];
switch (def.category) {
case 'production': return { gold, rawWood: level * 5, rawStone: level * 3 };
case 'refinery':   return { gold, lumber: level * 2, stoneBlock: level * 1 };
case 'defense':    return { gold, stoneBlock: level * 2, lumber: level * 1 };
case 'logistics':  return { gold, lumber: level * 3 };
default:           return { gold };
}
}

// -- Initial Building Layout --------------------------
function buildInitialBuildings() {
const mk = (id,type,tx,ty) => {
const d = BDEF[type];
return {
id, type, tx, ty, level:1,
hp: d.baseHp, maxHp: d.baseHp,
timer:0,       // production/refine countdown
burning:false, burnTimer:0,
repairBuffer:0,
active:true,   // false when burning / destroyed
};
};
return [
// Production (outside castle)
mk('woodcutter','WOODCUTTER',  2, 2),
mk('quarry',    'QUARRY',     14, 2),
mk('farm',      'FARM',        2,14),

// Refineries (inside courtyard)
mk('sawmill',   'SAWMILL',     5, 6),
mk('stonemason','STONEMASON', 11, 6),

// Special / logistics (inside)
mk('greathall', 'GREAT_HALL',  8, 7),
mk('storage',   'STORAGE',     7, 9),

// Towers -- wall corners
mk('tw_nw','TOWER', 4, 4),
mk('tw_ne','TOWER', 12, 4),
mk('tw_sw','TOWER', 4,12),
mk('tw_se','TOWER', 12,12),

// Wall segments -- north face
mk('wn1','WALL', 5,4), mk('wn2','WALL', 6,4), mk('wn3','WALL', 7,4),
mk('wn4','WALL', 9,4), mk('wn5','WALL',10,4), mk('wn6','WALL',11,4),
// Wall segments -- south face
mk('ws1','WALL', 5,12), mk('ws2','WALL', 6,12), mk('ws3','WALL', 7,12),
mk('ws4','WALL', 9,12), mk('ws5','WALL',10,12), mk('ws6','WALL',11,12),
// Wall segments -- east & west
mk('we1','WALL',12, 5), mk('we2','WALL',12, 6), mk('we3','WALL',12, 7),
mk('we4','WALL',12, 9), mk('we5','WALL',12,10), mk('we6','WALL',12,11),
mk('ww1','WALL', 4, 5), mk('ww2','WALL', 4, 6), mk('ww3','WALL', 4, 7),
mk('ww4','WALL', 4, 9), mk('ww5','WALL', 4,10), mk('ww6','WALL', 4,11),

// Gate -- south centre
mk('gate','GATE', 8,12),

];
}

// -- Bandit Definitions -------------------------------
const BNDDEF = {
SCOUT:      { name:'Flinker Plünderer',      hp: 45,  spd:1.6, dmg: 5,  atkRate:1.0, reward:3,  col:'#e06040', sz:7,  armor:0,    target:'storage',  special:'fast'    },
ARSONIST:   { name:'Fackelträger',           hp: 85,  spd:1.0, dmg: 0,  atkRate:0,   reward:5,  col:'#e09020', sz:9,  armor:0,    target:'building', special:'arson'   },
TANK:       { name:'Gepanzerter Schläger',   hp:450,  spd:0.5, dmg:22,  atkRate:0.5, reward:15, col:'#505878', sz:13, armor:0.5,  target:'wall',     special:'armored' },
INTERCEPTER:{ name:'Karren-Dieb',            hp:110,  spd:1.1, dmg: 0,  atkRate:0,   reward:8,  col:'#906070', sz:9,  armor:0,    target:'gate',     special:'blocker' },
SAPPER:     { name:'Belagerungs-Techniker',  hp:170,  spd:0.7, dmg:55,  atkRate:0.3, reward:20, col:'#408060', sz:11, armor:0.15, target:'wall',     special:'sapper'  },
};

// -- Wave Compositions ---------------------------------
const WAVES = [
[{t:'SCOUT',n:3}],
[{t:'SCOUT',n:4},{t:'ARSONIST',n:1}],
[{t:'SCOUT',n:3},{t:'TANK',n:1}],
[{t:'SCOUT',n:5},{t:'ARSONIST',n:2},{t:'INTERCEPTER',n:1}],
[{t:'TANK',n:2},{t:'ARSONIST',n:2},{t:'SCOUT',n:5}],
[{t:'SAPPER',n:1},{t:'TANK',n:2},{t:'SCOUT',n:6}],
[{t:'SAPPER',n:2},{t:'ARSONIST',n:3},{t:'INTERCEPTER',n:2}],
[{t:'SAPPER',n:2},{t:'TANK',n:3},{t:'ARSONIST',n:2},{t:'SCOUT',n:8}],
[{t:'SAPPER',n:3},{t:'TANK',n:4},{t:'INTERCEPTER',n:3},{t:'ARSONIST',n:4}],
[{t:'SAPPER',n:4},{t:'TANK',n:5},{t:'ARSONIST',n:5},{t:'SCOUT',n:10},{t:'INTERCEPTER',n:3}],
];

// Bandit waypoints (tile coords) -- they enter south, move north to gate, then greathall
const BANDIT_PATH = [
{tx:8,ty:16},{tx:8,ty:13},{tx:8,ty:12}, // approach & gate
{tx:8,ty:10},{tx:8,ty: 8},{tx:8,ty: 7}, // breach into courtyard
];
// Spread offsets so bandits don't all stack exactly
const SPAWN_SPREAD = [-0.9,-0.5,0,0.5,0.9];

// -- Resource config ----------------------------------
const RES_NAMES = {
rawWood:'Rohholz', rawStone:'Rohstein', food:'Nahrung',
lumber:'Bauholz', stoneBlock:'Steinquader', gold:'Gold'
};
const RES_ICONS = {
rawWood:'🪵', rawStone:'🪨', food:'🍞',
lumber:'📦', stoneBlock:'🧱', gold:'💰'
};

// Repair rate (HP per second) per resource unit
const REPAIR_HP_PER_SEC  = 18;
const REPAIR_RES_PER_SEC = 0.15; // resource units consumed per second of repair

// Max total waves
const TOTAL_WAVES = 10;
const WAVE_INTERVAL = 60; // seconds between waves
const PRE_SIEGE_WARN = 10; // seconds of warning
