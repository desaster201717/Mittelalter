‘use strict’;
/* =====================================================
STRONGHOLD SIEGE — js/game.js
Game state, update logic, isometric renderer
===================================================== */

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let G = null; // global game state — initialised in main.js

function createState() {
return {
phase:     ‘PEACE’,   // PEACE | WARNING | SIEGE | VICTORY | DEFEAT
waveNum:   0,
waveTimer: WAVE_INTERVAL,
warnTimer: 0,
spawnQueue:[],        // {type, delay} bandits pending spawn
spawnTimer:0,

```
resources: { rawWood:30, rawStone:20, food:50, lumber:5, stoneBlock:3, gold:20 },
caps:      { rawWood:120, rawStone:100, food:180, lumber:60, stoneBlock:48, gold:600 },

map:       buildMap(),
buildings: buildInitialBuildings(),
bandits:   [],
carts:     [],
particles: [],
projectiles:[],

priSlots:  [null, null, null], // building IDs assigned to priority slots

boostCooldowns: { eimer:0, steine:0, kriegsrat:0 },
kriegsratTimer: 0, // remaining duration of tower buff

selectedBldg: null,   // id
messages: [],
stats: { wavesCleared:0, banditsDefeated:0, totalProduced:0 },

// Cart ID counter
_cartId: 0,
_bandId: 0,
_partId: 0,
_projId: 0,
```

};
}

// ═══════════════════════════════════════════════════════
// UPDATE  (called each frame, dt in seconds)
// ═══════════════════════════════════════════════════════
function update(dt) {
if (!G || G.phase === ‘VICTORY’ || G.phase === ‘DEFEAT’) return;

updateWaveTimer(dt);
updateProduction(dt);
updateRefineries(dt);
updateBandits(dt);
updateCarts(dt);
updateTowers(dt);
updateRepairs(dt);
updateBurning(dt);
updateParticles(dt);
updateProjectiles(dt);
updateBoostTimers(dt);
checkDefeat();
}

// ── Wave timer ──────────────────────────────────────────
function updateWaveTimer(dt) {
if (G.phase === ‘PEACE’) {
G.waveTimer -= dt;
if (G.waveTimer <= PRE_SIEGE_WARN && G.waveTimer > 0) {
G.phase = ‘WARNING’;
addMsg(‘⚠ Banditen gesichtet! Bereite dich vor!’, ‘warn’);
}
if (G.waveTimer <= 0) startWave();
}
if (G.phase === ‘WARNING’) {
G.waveTimer -= dt;
if (G.waveTimer <= 0) startWave();
}
if (G.phase === ‘SIEGE’) {
// Check wave cleared
if (G.bandits.length === 0 && G.spawnQueue.length === 0 && G.spawnTimer <= 0) {
endWave();
}
}
}

function startWave() {
G.waveNum++;
G.phase = ‘SIEGE’;
G.waveTimer = 0;

const idx = Math.min(G.waveNum - 1, WAVES.length - 1);
const composition = WAVES[idx];
G.spawnQueue = [];
let delay = 0;
for (const entry of composition) {
for (let i = 0; i < entry.n; i++) {
G.spawnQueue.push({ type: entry.t, delay });
delay += 0.8 + Math.random() * 0.6;
}
}
G.spawnTimer = 0;
addMsg(`⚔ Welle ${G.waveNum}/${TOTAL_WAVES} beginnt!`, ‘alert’);
}

function endWave() {
G.stats.wavesCleared++;
const goldReward = G.waveNum * 8 + 10;
G.resources.gold = Math.min(G.caps.gold, G.resources.gold + goldReward);
addMsg(`✓ Welle ${G.waveNum} überstanden! +${goldReward} Gold`, ‘good’);

if (G.waveNum >= TOTAL_WAVES) {
G.phase = ‘VICTORY’;
} else {
G.phase = ‘PEACE’;
G.waveTimer = WAVE_INTERVAL;
G.priSlots = [null, null, null];
}
}

// ── Spawn bandits from queue ─────────────────────────────
function spawnPendingBandits(dt) {
if (G.spawnQueue.length === 0) return;
G.spawnTimer -= dt;
if (G.spawnTimer > 0) return;

const entry = G.spawnQueue.shift();
spawnBandit(entry.type);
G.spawnTimer = G.spawnQueue.length > 0 ? G.spawnQueue[0].delay : 0;
}

function spawnBandit(type) {
const def = BNDDEF[type];
const spread = SPAWN_SPREAD[G._bandId % SPAWN_SPREAD.length];
G.bandits.push({
id:       ‘b’ + G._bandId++,
type,
tx:       8 + spread,
ty:       16.5,
hp:       def.hp,
maxHp:    def.hp,
spd:      def.spd,
wpIdx:    0,                   // current waypoint index
atkTimer: 0,
state:    ‘moving’,            // moving | attacking | dead
targetId: null,
reachedGate: false,
});
}

// ── Production ─────────────────────────────────────────
function updateProduction(dt) {
for (const b of G.buildings) {
const def = BDEF[b.type];
if (def.category !== ‘production’ && def.category !== ‘special’) continue;
if (!b.active || b.burning) continue;

```
const res = def.produces;
if (!res) continue;
if (G.resources[res] >= G.caps[res]) continue;

const rate = def.baseOutput + def.outputPerLvl * (b.level - 1);
G.resources[res] = Math.min(G.caps[res], G.resources[res] + rate * dt);
G.stats.totalProduced += rate * dt;

// Spawn a cart occasionally for visual feedback
if (Math.random() < dt * 0.4) spawnVisualCart(b, 'storage');
```

}
}

// ── Refineries ─────────────────────────────────────────
function updateRefineries(dt) {
for (const b of G.buildings) {
const def = BDEF[b.type];
if (def.category !== ‘refinery’) continue;
if (!b.active || b.burning) continue;

```
b.timer -= dt;
if (b.timer > 0) continue;

// Check inputs
let canProcess = true;
for (const [res, amt] of Object.entries(def.input)) {
  if ((G.resources[res] || 0) < amt) { canProcess = false; break; }
}
if (!canProcess) { b.timer = 1.5; continue; } // retry delay

// Consume inputs
for (const [res, amt] of Object.entries(def.input)) {
  G.resources[res] -= amt;
}
// Produce outputs
for (const [res, amt] of Object.entries(def.output)) {
  G.resources[res] = Math.min(G.caps[res], (G.resources[res] || 0) + amt);
}

// Speed bonus per level
const speedMult = 1 + 0.15 * (b.level - 1);
b.timer = def.procTime / speedMult;

// Visual cart
spawnVisualCart(b, 'storage');
```

}
}

// ── Bandit movement & actions ───────────────────────────
function updateBandits(dt) {
spawnPendingBandits(dt);

for (let i = G.bandits.length - 1; i >= 0; i–) {
const bn = G.bandits[i];
if (bn.state === ‘dead’) { G.bandits.splice(i, 1); continue; }

```
const def = BNDDEF[bn.type];

// Arsonist special: find nearest non-wall building and move toward it
if (def.special === 'arson' && bn.state === 'moving') {
  const inside = isInsideWalls(bn.tx, bn.ty);
  if (inside) {
    // Find nearest burnable production building
    let nearest = null, nearDist = 999;
    for (const bldg of G.buildings) {
      if (!BDEF[bldg.type] || !BDEF[bldg.type].canBurn || bldg.burning) continue;
      const dist = Math.hypot(bldg.tx - bn.tx, bldg.ty - bn.ty);
      if (dist < nearDist) { nearDist = dist; nearest = bldg; }
    }
    if (nearest && nearDist < 0.8) {
      setFire(nearest, def.fireDuration || 12);
      bn.state = 'dead';
      goldReward(def);
      continue;
    }
  }
}

// Movement toward next waypoint
if (bn.wpIdx < BANDIT_PATH.length) {
  const wp = BANDIT_PATH[bn.wpIdx];
  const dx = wp.tx - bn.tx;
  const dy = wp.ty - bn.ty;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.12) {
    // Reached waypoint
    if (wp.tx === 8 && wp.ty === 12) {
      // Reached gate
      const gate = G.buildings.find(b => b.type === 'GATE');
      if (gate && gate.hp > 0) {
        // Attack gate
        bn.state = 'attacking';
        bn.targetId = gate.id;
      } else {
        bn.wpIdx++; // Gate broken, continue inside
      }
    } else {
      bn.wpIdx++;
    }
  } else {
    const speed = def.spd * (def.special === 'fast' ? 1.0 : 1.0);
    bn.tx += (dx / dist) * speed * dt;
    bn.ty += (dy / dist) * speed * dt;
  }
} else {
  // Reached great hall
  const hall = G.buildings.find(b => b.type === 'GREAT_HALL');
  if (hall && hall.hp > 0) {
    attackBuilding(bn, hall, dt);
  } else {
    bn.state = 'dead';
  }
}

// Attack logic when at gate or wall
if (bn.state === 'attacking') {
  const target = G.buildings.find(b => b.id === bn.targetId);
  if (!target || target.hp <= 0) {
    bn.state = 'moving';
    bn.targetId = null;
    bn.wpIdx++;
  } else {
    attackBuilding(bn, target, dt);
  }
}

// SAPPER: move toward nearest wall segment at castle perimeter
if (def.special === 'sapper' && !bn.reachedGate) {
  const nearWall = findNearestWall(bn);
  if (nearWall) {
    const dist = Math.hypot(nearWall.tx - bn.tx, nearWall.ty - bn.ty);
    if (dist < 0.8) {
      bn.state = 'attacking';
      bn.targetId = nearWall.id;
    }
  }
}
```

}
}

function attackBuilding(bandit, building, dt) {
const def = BNDDEF[bandit.type];
bandit.atkTimer -= dt;
if (bandit.atkTimer > 0) return;
bandit.atkTimer = 1 / (def.atkRate || 1);

const dmg = def.dmg;
building.hp = Math.max(0, building.hp - dmg);

// Particle effect
spawnHitParticle(building.tx, building.ty);

if (building.hp <= 0) {
building.active = false;
addMsg(`💥 ${BDEF[building.type].name} wurde zerstört!`, ‘alert’);
bandit.state = ‘moving’;
bandit.wpIdx++;
}
}

function findNearestWall(bandit) {
let nearest = null, nearDist = 3.5;
for (const b of G.buildings) {
if (b.type !== ‘WALL’ || b.hp <= 0) continue;
const dist = Math.hypot(b.tx - bandit.tx, b.ty - bandit.ty);
if (dist < nearDist) { nearDist = dist; nearest = b; }
}
return nearest;
}

function goldReward(bndef) {
G.resources.gold = Math.min(G.caps.gold, G.resources.gold + bndef.reward);
G.stats.banditsDefeated++;
}

function setFire(building, duration) {
building.burning = true;
building.burnTimer = duration;
building.active = false;
addMsg(`🔥 ${BDEF[building.type].name} steht in Flammen!`, ‘alert’);
spawnFireParticles(building.tx, building.ty);
}

function updateBurning(dt) {
for (const b of G.buildings) {
if (!b.burning) continue;
b.burnTimer -= dt;
if (b.burnTimer <= 0) {
b.burning = false;
b.active = true;
b.hp = Math.max(1, Math.floor(b.maxHp * 0.25)); // survives at 25%
addMsg(`🚒 ${BDEF[b.type].name} – Feuer gelöscht!`, ‘good’);
}
}
}

// ── Tower auto-attack ───────────────────────────────────
function updateTowers(dt) {
const dpsBoost = G.kriegsratTimer > 0 ? 1.5 : 1.0;

for (const b of G.buildings) {
if (b.type !== ‘TOWER’ || b.hp <= 0) continue;
const def = BDEF.TOWER;
const range = def.range + def.rangePerLvl * (b.level - 1);
const dps   = (def.dps + def.dpsPerLvl * (b.level - 1)) * dpsBoost;

```
b.atkTimer = (b.atkTimer || 0) - dt;
if (b.atkTimer > 0) continue;

// Find nearest bandit in range
let target = null, nearDist = range;
for (const bn of G.bandits) {
  if (bn.state === 'dead') continue;
  const d = Math.hypot(bn.tx - b.tx, bn.ty - b.ty);
  if (d < nearDist) { nearDist = d; target = bn; }
}

if (target) {
  const armor   = BNDDEF[target.type].armor || 0;
  const dmg     = dps * 0.5 * (1 - armor); // fire every 0.5s
  target.hp    -= dmg;
  b.atkTimer    = 0.5;
  spawnProjectile(b, target);

  if (target.hp <= 0) {
    target.state = 'dead';
    goldReward(BNDDEF[target.type]);
  }
}
```

}
}

// ── Priority Repair ─────────────────────────────────────
function updateRepairs(dt) {
if (G.phase !== ‘SIEGE’ && G.phase !== ‘WARNING’) return;

const pcts = [0.70, 0.20, 0.10];
for (let slot = 0; slot < 3; slot++) {
const id = G.priSlots[slot];
if (!id) continue;

```
const bldg = G.buildings.find(b => b.id === id);
if (!bldg || bldg.hp >= bldg.maxHp || bldg.burning) continue;

const def    = BDEF[bldg.type];
const resKey = def.repairRes;
if (!resKey) continue;
if ((G.resources[resKey] || 0) <= 0) continue;

const rate  = REPAIR_HP_PER_SEC * pcts[slot] * dt;
const cost  = REPAIR_RES_PER_SEC * pcts[slot] * dt;

G.resources[resKey] = Math.max(0, G.resources[resKey] - cost);
bldg.hp = Math.min(bldg.maxHp, bldg.hp + rate);

// Update priority slot HP bar
const fill = document.getElementById('pb-' + slot);
if (fill) fill.style.width = (bldg.hp / bldg.maxHp * 100) + '%';
```

}
}

// ── Carts (visual only) ─────────────────────────────────
let _cartSpawnCooldown = 0;
function updateCarts(dt) {
_cartSpawnCooldown -= dt;
for (let i = G.carts.length - 1; i >= 0; i–) {
const c = G.carts[i];
c.progress += dt / c.duration;
if (c.progress >= 1) { G.carts.splice(i, 1); }
}
}

function spawnVisualCart(fromBldg, toBldgId) {
const toB = G.buildings.find(b => b.id === toBldgId || b.type === ‘STORAGE’);
if (!toB) return;
G.carts.push({
id: ‘c’ + G._cartId++,
fx: fromBldg.tx, fy: fromBldg.ty,
tx: toB.tx + (Math.random()-0.5)*0.4,
ty: toB.ty + (Math.random()-0.5)*0.4,
progress: 0,
duration: 2.5 + Math.random(),
col: ‘#d4a820’,
});
}

// ── Particles ───────────────────────────────────────────
function spawnHitParticle(tx, ty) {
for (let i = 0; i < 5; i++) {
G.particles.push({
id: ‘p’ + G._partId++,
tx: tx + (Math.random()-0.5)*0.5,
ty: ty + (Math.random()-0.5)*0.5,
vy: -0.04 - Math.random()*0.04,
vx: (Math.random()-0.5)*0.06,
life: 0.5 + Math.random()*0.3,
maxLife: 0.8,
col: ‘#e08040’,
size: 3 + Math.random()*3,
});
}
}

function spawnFireParticles(tx, ty) {
for (let i = 0; i < 12; i++) {
G.particles.push({
id: ‘p’ + G._partId++,
tx: tx + (Math.random()-0.5)*0.7,
ty: ty + (Math.random()-0.5)*0.7,
vy: -0.08 - Math.random()*0.06,
vx: (Math.random()-0.5)*0.04,
life: 1.0 + Math.random()*0.8,
maxLife: 1.8,
col: Math.random() > 0.5 ? ‘#ff6020’ : ‘#ffa020’,
size: 4 + Math.random()*4,
});
}
}

function updateParticles(dt) {
for (let i = G.particles.length - 1; i >= 0; i–) {
const p = G.particles[i];
p.tx += p.vx;
p.ty += p.vy;
p.life -= dt;
if (p.life <= 0) G.particles.splice(i, 1);
}
}

// ── Projectiles ─────────────────────────────────────────
function spawnProjectile(tower, bandit) {
G.projectiles.push({
id: ‘j’ + G._projId++,
fx: tower.tx, fy: tower.ty,
tx: bandit.tx, ty: bandit.ty,
progress: 0, duration: 0.25,
});
}

function updateProjectiles(dt) {
for (let i = G.projectiles.length - 1; i >= 0; i–) {
const p = G.projectiles[i];
p.progress += dt / p.duration;
if (p.progress >= 1) G.projectiles.splice(i, 1);
}
}

// ── Boost timers ────────────────────────────────────────
function updateBoostTimers(dt) {
for (const k of Object.keys(G.boostCooldowns)) {
G.boostCooldowns[k] = Math.max(0, G.boostCooldowns[k] - dt);
}
G.kriegsratTimer = Math.max(0, G.kriegsratTimer - dt);
}

// ── Defeat check ────────────────────────────────────────
function checkDefeat() {
const gate = G.buildings.find(b => b.type === ‘GATE’);
const hall = G.buildings.find(b => b.type === ‘GREAT_HALL’);
if ((gate && gate.hp <= 0 && !gate.active) || (hall && hall.hp <= 0)) {
G.phase = ‘DEFEAT’;
}
}

// ── Utility ─────────────────────────────────────────────
function isInsideWalls(tx, ty) {
return tx > 4 && tx < 12 && ty > 4 && ty < 12;
}

// ── Upgrades ────────────────────────────────────────────
function tryUpgrade(bldgId) {
const b = G.buildings.find(x => x.id === bldgId);
if (!b) return;
const def  = BDEF[b.type];
if (b.level >= def.maxLvl) { addMsg(‘Maximale Stufe erreicht!’, ‘warn’); return; }

const cost = upgradeResources(b.type, b.level);
// Check affordability
for (const [res, amt] of Object.entries(cost)) {
if ((G.resources[res] || 0) < amt) {
addMsg(`Nicht genug ${RES_NAMES[res] || res}!`, ‘warn’);
return;
}
}
// Deduct
for (const [res, amt] of Object.entries(cost)) G.resources[res] -= amt;

b.level++;
b.maxHp = def.baseHp + (def.hpPerLvl || 0) * b.level;
b.hp    = Math.min(b.hp + (def.hpPerLvl || 0), b.maxHp);
addMsg(`✓ ${def.name} → Stufe ${b.level}`, ‘good’);
}

// ── Boost actions ────────────────────────────────────────
function activateEimer() {
if (G.boostCooldowns.eimer > 0) return addMsg(‘Boost noch nicht bereit!’, ‘warn’);
if (G.resources.food < 50)       return addMsg(‘Nicht genug Nahrung! (−50🍞)’, ‘warn’);
G.resources.food -= 50;
// Extinguish all fires 3× faster (just instant for simplicity)
for (const b of G.buildings) {
if (b.burning) { b.burnTimer *= 0.33; }
}
G.priSlots[0] = null; // clears prio 1 (mauer reparatur pausiert)
G.boostCooldowns.eimer = 90;
addMsg(‘🪣 Alle an die Eimer! Brände werden gelöscht!’, ‘good’);
}

function activateSteine() {
if (G.boostCooldowns.steine > 0) return addMsg(‘Boost noch nicht bereit!’, ‘warn’);
const gate = G.buildings.find(b => b.type === ‘GATE’);
if (!gate) return;
gate.hp = Math.min(gate.maxHp, gate.hp + gate.maxHp * 0.25);
G.boostCooldowns.steine = 200;
addMsg(‘🧱 Notfall-Steine! Burgtor +25% HP!’, ‘good’);
}

function activateKriegsrat() {
if (G.boostCooldowns.kriegsrat > 0) return addMsg(‘Boost noch nicht bereit!’, ‘warn’);
if (G.waveNum < 5) return addMsg(‘Kriegsrat erst ab Welle 5!’, ‘warn’);
if ((G.resources.weapons || 0) < 30) return addMsg(‘Nicht genug Waffen! (−30⚔)’, ‘warn’);
G.resources.weapons = (G.resources.weapons || 0) - 30;
G.kriegsratTimer     = 20;
G.boostCooldowns.kriegsrat = 150;
addMsg(‘⚔ Kriegsrat! Türme +50% DPS für 20s!’, ‘good’);
}

// ═══════════════════════════════════════════════════════
// RENDERER
// ═══════════════════════════════════════════════════════
let canvas, ctx;

function initRenderer(c) {
canvas = c;
ctx    = c.getContext(‘2d’);
}

function render() {
if (!canvas || !ctx || !G) return;
ctx.clearRect(0, 0, canvas.width, canvas.height);

// Gradient sky background
const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
bg.addColorStop(0, ‘#1a2830’);
bg.addColorStop(1, ‘#0a1008’);
ctx.fillStyle = bg;
ctx.fillRect(0, 0, canvas.width, canvas.height);

drawMap();
drawBuildingLayer();
drawCarts();
drawProjectiles();
drawBandits();
drawParticles();
drawUICanvas();
}

// ── Tile rendering ───────────────────────────────────────
function drawMap() {
for (let d = 0; d < MAP_W + MAP_H - 1; d++) {
for (let ty = 0; ty < MAP_H; ty++) {
const tx = d - ty;
if (tx < 0 || tx >= MAP_W) continue;
drawTile(tx, ty);
}
}
}

function drawTile(tx, ty) {
const tileType = G.map[ty][tx];
const col      = TILE_COL[tileType] || TILE_COL[T.GRASS];
const {x, y}   = toSc(tx, ty);
const hw = TILE_W / 2, hh = TILE_H / 2;

ctx.beginPath();
ctx.moveTo(x,      y - hh);
ctx.lineTo(x + hw, y);
ctx.lineTo(x,      y + hh);
ctx.lineTo(x - hw, y);
ctx.closePath();
ctx.fillStyle   = col.top;
ctx.fill();
ctx.strokeStyle = ‘rgba(0,0,0,0.18)’;
ctx.lineWidth   = 0.6;
ctx.stroke();
}

// ── Building rendering ────────────────────────────────────
function drawBuildingLayer() {
// Sort by (tx+ty) for correct painter’s order
const sorted = […G.buildings].sort((a, b) => (a.tx + a.ty) - (b.tx + b.ty));
for (const bldg of sorted) drawBuilding(bldg);
}

function drawBuilding(b) {
const def  = BDEF[b.type];
if (!def) return;
const col  = def.col;
const {x, y} = toSc(b.tx, b.ty);
const hw = TILE_W / 2, hh = TILE_H / 2;

// Scale depth slightly with level
const depth = def.depth + (b.level - 1) * 4;

// Fire tint
const fireMix = b.burning ? 0.5 + 0.3 * Math.sin(Date.now() * 0.006) : 0;

function mixFire(hex) {
return fireMix > 0 ? blendHex(hex, ‘#ff4010’, fireMix) : hex;
}

// Low HP red tint
const hpRatio = b.hp / b.maxHp;
const lowHp   = hpRatio < 0.35;

// Top face
ctx.beginPath();
ctx.moveTo(x,      y - hh - depth);
ctx.lineTo(x + hw, y - depth);
ctx.lineTo(x,      y + hh - depth);
ctx.lineTo(x - hw, y - depth);
ctx.closePath();
ctx.fillStyle   = mixFire(lowHp ? blendHex(col.top,’#cc1010’,0.25) : col.top);
ctx.fill();
ctx.strokeStyle = ‘rgba(0,0,0,0.35)’;
ctx.lineWidth   = 1;
ctx.stroke();

// Right face
ctx.beginPath();
ctx.moveTo(x + hw, y - depth);
ctx.lineTo(x + hw, y);
ctx.lineTo(x,      y + hh);
ctx.lineTo(x,      y + hh - depth);
ctx.closePath();
ctx.fillStyle = mixFire(lowHp ? blendHex(col.r,’#aa0808’,0.25) : col.r);
ctx.fill();
ctx.stroke();

// Left face
ctx.beginPath();
ctx.moveTo(x - hw, y - depth);
ctx.lineTo(x - hw, y);
ctx.lineTo(x,      y + hh);
ctx.lineTo(x,      y + hh - depth);
ctx.closePath();
ctx.fillStyle = mixFire(lowHp ? blendHex(col.l,’#880606’,0.25) : col.l);
ctx.fill();
ctx.stroke();

// HP bar (only if damaged)
if (b.hp < b.maxHp && b.hp > 0) {
drawHpBar(x, y - depth - 8, b.hp / b.maxHp, 32);
}

// Priority indicator
const priIdx = G.priSlots.indexOf(b.id);
if (priIdx >= 0) {
ctx.fillStyle = [’#e03020’,’#e09020’,’#e0c020’][priIdx];
ctx.font = ‘bold 11px Cinzel, serif’;
ctx.textAlign = ‘center’;
ctx.fillText(‘P’ + (priIdx + 1), x, y - depth - 14);
}

// Repair hammer icon
if (G.priSlots.includes(b.id) && b.hp < b.maxHp) {
ctx.font = ‘11px serif’;
ctx.textAlign = ‘center’;
ctx.fillText(‘🔨’, x, y - depth - 22);
}

// Burning flame icon
if (b.burning) {
ctx.font = ‘13px serif’;
ctx.textAlign = ‘center’;
ctx.fillText(‘🔥’, x, y - depth - 18);
}
}

function drawHpBar(x, y, ratio, width) {
const h = 4;
ctx.fillStyle = ‘rgba(0,0,0,0.5)’;
ctx.fillRect(x - width/2, y, width, h);
const col = ratio > 0.5 ? ‘#40c040’ : ratio > 0.25 ? ‘#d0a020’ : ‘#d02020’;
ctx.fillStyle = col;
ctx.fillRect(x - width/2, y, width * ratio, h);
}

// ── Carts ────────────────────────────────────────────────
function drawCarts() {
for (const c of G.carts) {
const tx = c.fx + (c.tx - c.fx) * c.progress;
const ty = c.fy + (c.ty - c.fy) * c.progress;
const {x, y} = toSc(tx, ty);
ctx.fillStyle = c.col;
ctx.shadowColor = ‘rgba(200,160,0,0.6)’;
ctx.shadowBlur  = 4;
ctx.fillRect(x - 4, y - 5, 8, 5);
ctx.shadowBlur = 0;
// Wheels
ctx.fillStyle = ‘#5a3010’;
ctx.fillRect(x - 4, y - 1, 3, 2);
ctx.fillRect(x + 1,  y - 1, 3, 2);
}
}

// ── Projectiles ──────────────────────────────────────────
function drawProjectiles() {
for (const p of G.projectiles) {
const tx = p.fx + (p.tx - p.fx) * p.progress;
const ty = p.fy + (p.ty - p.fy) * p.progress;
const sc = toSc(tx, ty);
ctx.fillStyle = ‘#e0c060’;
ctx.shadowColor = ‘#ffee80’;
ctx.shadowBlur  = 6;
ctx.beginPath();
ctx.arc(sc.x, sc.y - 10, 3, 0, Math.PI * 2);
ctx.fill();
ctx.shadowBlur = 0;
}
}

// ── Bandits ──────────────────────────────────────────────
function drawBandits() {
for (const bn of G.bandits) {
if (bn.state === ‘dead’) continue;
const def   = BNDDEF[bn.type];
const {x, y} = toSc(bn.tx, bn.ty);
const sz    = def.sz;

```
ctx.shadowColor = def.col;
ctx.shadowBlur  = 8;

// Body: isometric diamond shape
ctx.fillStyle = def.col;
ctx.beginPath();
ctx.moveTo(x,      y - sz - 8);
ctx.lineTo(x + sz, y - 8);
ctx.lineTo(x,      y + sz/2 - 8);
ctx.lineTo(x - sz, y - 8);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = 'rgba(0,0,0,0.5)';
ctx.lineWidth = 1;
ctx.stroke();
ctx.shadowBlur = 0;

// HP bar
drawHpBar(x, y - sz - 18, bn.hp / bn.maxHp, sz * 2.4);

// Type letter
ctx.fillStyle = 'rgba(255,255,255,0.85)';
ctx.font = `bold ${Math.floor(sz*0.75)}px monospace`;
ctx.textAlign = 'center';
ctx.fillText(bn.type[0], x, y - 8 + sz * 0.25);
```

}
}

// ── Particles ────────────────────────────────────────────
function drawParticles() {
for (const p of G.particles) {
const {x, y} = toSc(p.tx, p.ty);
const alpha = Math.max(0, p.life / p.maxLife);
ctx.globalAlpha = alpha;
ctx.fillStyle   = p.col;
ctx.beginPath();
ctx.arc(x, y - 12, p.size * alpha, 0, Math.PI * 2);
ctx.fill();
}
ctx.globalAlpha = 1;
}

// ── Canvas UI overlays (hp text, selection ring) ──────────
function drawUICanvas() {
// Selection ring
if (G.selectedBldg) {
const b = G.buildings.find(x => x.id === G.selectedBldg);
if (b) {
const {x, y} = toSc(b.tx, b.ty);
const hw = TILE_W / 2, hh = TILE_H / 2;
ctx.strokeStyle = ‘#ffd060’;
ctx.lineWidth = 2;
ctx.setLineDash([4, 3]);
ctx.beginPath();
ctx.moveTo(x,      y - hh);
ctx.lineTo(x + hw, y);
ctx.lineTo(x,      y + hh);
ctx.lineTo(x - hw, y);
ctx.closePath();
ctx.stroke();
ctx.setLineDash([]);
}
}

// Siege vignette
if (G.phase === ‘SIEGE’) {
const alpha = 0.06 + 0.04 * Math.sin(Date.now() * 0.003);
const grad  = ctx.createRadialGradient(
canvas.width/2, canvas.height/2, canvas.height * 0.3,
canvas.width/2, canvas.height/2, canvas.height * 0.9,
);
grad.addColorStop(0, ‘rgba(180,0,0,0)’);
grad.addColorStop(1, `rgba(180,0,0,${alpha})`);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, canvas.width, canvas.height);
}
}

// ── Colour helpers ───────────────────────────────────────
function hexToRgb(hex) {
const r = parseInt(hex.slice(1,3),16);
const g = parseInt(hex.slice(3,5),16);
const b = parseInt(hex.slice(5,7),16);
return [r,g,b];
}
function blendHex(hexA, hexB, t) {
const [r1,g1,b1] = hexToRgb(hexA);
const [r2,g2,b2] = hexToRgb(hexB);
const r = Math.round(r1 + (r2-r1)*t);
const g = Math.round(g1 + (g2-g1)*t);
const b = Math.round(b1 + (b2-b1)*t);
return `rgb(${r},${g},${b})`;
}

// ── Messages ─────────────────────────────────────────────
function addMsg(text, type=‘info’) {
G.messages.push({ text, type, ts: Date.now() });
if (G.messages.length > 8) G.messages.shift();
renderMessages();
}

function renderMessages() {
const el = document.getElementById(‘msgLog’);
if (!el) return;
el.innerHTML = ‘’;
const recent = G.messages.slice(-5).reverse();
for (const m of recent) {
const div = document.createElement(‘div’);
div.className = ’msg ’ + (m.type || ‘’);
div.textContent = m.text;
el.appendChild(div);
// Fade after 5s
setTimeout(() => div.classList.add(‘fade’), 4500);
}
}

// ── Hit test: which building is at screen position? ──────
function pickBuilding(sx, sy) {
const {tx: rtx, ty: rty} = toTile(sx, sy);
// Search nearby tiles (buildings can be slightly offset)
let closest = null, closestDist = 1.5;
for (const b of G.buildings) {
const d = Math.hypot(b.tx - rtx, b.ty - rty);
if (d < closestDist) { closestDist = d; closest = b; }
}
return closest;
}
