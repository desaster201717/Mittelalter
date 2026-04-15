'use strict';
/* =====================================================
STRONGHOLD SIEGE -- js/main.js
Entry point, game loop, UI event handlers
===================================================== */

let _lastTime = 0;
let _running  = false;

// -- Init ----------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
const canvas = document.getElementById('gameCanvas');
initRenderer(canvas);
resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

G = createState();
bindUI(canvas);
startLoop();
addMsg('Willkommen in der Baronschaft! Klicke auf Gebäude zum Ausbauen.', 'good');
addMsg('Tipp: Weise beschädigten Gebäuden Reparatur-Prioritäten zu!', 'info');
});

function resizeCanvas(canvas) {
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
// Re-center isometric origin
OX = Math.floor(canvas.width  / 2);
OY = Math.floor(canvas.height * 0.14);
}

// -- Game loop -----------------------------------------
function startLoop() {
_running = true;
requestAnimationFrame(loop);
}

function loop(ts) {
if (!_running) return;
const dt = Math.min((ts - _lastTime) / 1000, 0.1); // cap dt at 100ms
_lastTime = ts;

if (G && G.phase !== 'VICTORY' && G.phase !== 'DEFEAT') {
update(dt);
updateHUD();
}
render();
checkOverlay();

requestAnimationFrame(loop);
}

// -- HUD update (DOM) ----------------------------------
function updateHUD() {
// Resources
const RKEYS = ['rawWood','rawStone','food','lumber','stoneBlock','gold'];
for (const k of RKEYS) {
const el = document.getElementById('rv-' + k);
if (!el) continue;
const val = Math.floor(G.resources[k] || 0);
const cap = G.caps[k] || 999;
el.textContent = val;
el.classList.toggle('at-cap', val >= cap);
}

// Wave / timer
document.getElementById('wNumVal').textContent  = G.waveNum;
const tag  = document.getElementById('phaseTag');
const secs = document.getElementById('wSecVal');
const wLabel = document.getElementById('waveCountdown');

if (G.phase === 'PEACE') {
if(secs) secs.textContent = Math.ceil(G.waveTimer);
if(wLabel) wLabel.textContent = 'Angriff in ' + Math.ceil(G.waveTimer) + 's';
tag.className = 'phase-peace'; tag.textContent = 'FRIEDEN';
} else if (G.phase === 'WARNING') {
if(secs) secs.textContent = Math.ceil(G.waveTimer);
if(wLabel) wLabel.textContent = '⚠ ANGRIFF IN ' + Math.ceil(G.waveTimer) + 's!';
tag.className = 'phase-warning'; tag.textContent = '⚠ ALARM!';
} else if (G.phase === 'SIEGE') {
const remaining = G.bandits.length + G.spawnQueue.length;
if(wLabel) wLabel.textContent = 'Banditen übrig: ' + remaining;
tag.className = 'phase-siege'; tag.textContent = '⚔ BELAGERUNG!';
}

// Priority console visibility
const prioEl = document.getElementById('prioConsole');
if (G.phase === 'SIEGE' || G.phase === 'WARNING') {
prioEl.classList.remove('hidden');
// Update slot targets
for (let i = 0; i < 3; i++) {
const id  = G.priSlots[i];
const pt  = document.getElementById('pt-' + i);
const pb  = document.getElementById('pb-' + i);
const sl  = document.getElementById('pslot-' + i);
if (id) {
const b  = G.buildings.find(x => x.id === id);
if (b) {
pt.textContent = BDEF[b.type].name;
pb.style.width = (b.hp / b.maxHp * 100).toFixed(1) + '%';
sl.classList.add('active-slot');
}
} else {
pt.textContent = '-- leer --';
pb.style.width = '100%';
sl.classList.remove('active-slot');
}
}
// Boost button states
document.getElementById('btn-eimer').disabled    = G.boostCooldowns.eimer    > 0;
document.getElementById('btn-steine').disabled   = G.boostCooldowns.steine   > 0;
document.getElementById('btn-kriegsrat').disabled= G.boostCooldowns.kriegsrat> 0;
} else {
prioEl.classList.add('hidden');
}

// Building panel (if open)
if (G.selectedBldg) refreshBuildingPanel();
}

function refreshBuildingPanel() {
const b   = G.buildings.find(x => x.id === G.selectedBldg);
if (!b) { closeBldgPanel(); return; }
const def = BDEF[b.type];

document.getElementById('bldgIcon').innerText  = def.icon;
document.getElementById('bldgName').innerText  = def.name;
document.getElementById('bldgLevel').textContent = `Stufe ${b.level} / ${def.maxLvl}`;
document.getElementById('hpFill').style.width    = (b.hp / b.maxHp * 100).toFixed(1) + '%';
document.getElementById('hpText').innerText    = `HP: ${Math.ceil(b.hp)} / ${b.maxHp}`;

let status = '';
if (b.burning)       status = '🔥 Steht in Flammen!';
else if (!b.active && b.hp <= 0) status = '💀 Zerstört';
else if (!b.active)  status = '⚠ Außer Betrieb';
document.getElementById('bldgStatus').textContent = status;

// Upgrade cost
if (b.level < def.maxLvl) {
const cost = upgradeResources(b.type, b.level);
const parts = Object.entries(cost).map(([r,a]) =>
`${RES_ICONS[r] || ''}${a} ${RES_NAMES[r] || r}`
);
document.getElementById('bldgCostText').textContent = 'Kosten: ' + parts.join(' · ');
document.getElementById('btn-upgrade').disabled = false;
} else {
document.getElementById('bldgCostText').textContent = '✓ Maximal ausgebaut';
document.getElementById('btn-upgrade').disabled = true;
}

// Highlight active priority button
const priIdx = G.priSlots.indexOf(b.id);
document.querySelectorAll('.pa-btn').forEach(btn => {
const p = parseInt(btn.dataset.p);
btn.classList.toggle('active-prio', p === priIdx);
});
}

// -- Overlay check -------------------------------------
let _overlayShown = false;
function checkOverlay() {
if (_overlayShown) return;
if (G.phase === 'DEFEAT') {
_overlayShown = true;
showOverlay(false);
} else if (G.phase === 'VICTORY') {
_overlayShown = true;
showOverlay(true);
}
}

function showOverlay(victory) {
const el    = document.getElementById('overlay');
const title = document.getElementById('overlayTitle');
const body  = document.getElementById('overlayBody');
const stats = document.getElementById('overlayStats');

title.textContent = victory ? '⚔ BARONSCHAFT VERTEIDIGT!' : '💀 NIEDERLAGE';
title.style.color = victory ? '#205080' : '#6a1010';
body.textContent  = victory
? 'Zehn Wellen überstanden! Die Baronie steht! Der Name des Barons wird in Stein gemeißelt.'
: 'Die Mauern sind gefallen. Die Banditen haben die Burg überrannt.';

stats.innerHTML = `Wellen überstanden: <strong>${G.stats.wavesCleared}</strong><br> Banditen besiegt:   <strong>${G.stats.banditsDefeated}</strong><br> Güter produziert:   <strong>${Math.floor(G.stats.totalProduced)}</strong>`;

el.classList.remove('hidden');
}

// -- UI Events -----------------------------------------
function bindUI(canvas) {
// Canvas click -> select building
canvas.addEventListener('click', e => {
const rect = canvas.getBoundingClientRect();
const sx   = e.clientX - rect.left;
const sy   = e.clientY - rect.top;
const b    = pickBuilding(sx, sy);
if (b) {
G.selectedBldg = b.id;
openBldgPanel(b);
} else {
G.selectedBldg = null;
closeBldgPanel();
}
});

// Close building panel
document.getElementById('bldgClose').addEventListener('click', () => {
G.selectedBldg = null;
closeBldgPanel();
});

// Upgrade button
document.getElementById('btn-upgrade').addEventListener('click', () => {
if (G.selectedBldg) tryUpgrade(G.selectedBldg);
});

// Priority assign buttons in building panel
document.querySelectorAll('.pa-btn').forEach(btn => {
btn.addEventListener('click', () => {
if (!G.selectedBldg) return;
const p = parseInt(btn.dataset.p);
if (p < 0) {
// Remove from all slots
for (let i = 0; i < 3; i++) {
if (G.priSlots[i] === G.selectedBldg) G.priSlots[i] = null;
}
} else {
// Remove from other slots first
for (let i = 0; i < 3; i++) {
if (G.priSlots[i] === G.selectedBldg) G.priSlots[i] = null;
}
G.priSlots[p] = G.selectedBldg;
const b   = G.buildings.find(x => x.id === G.selectedBldg);
const name = b ? BDEF[b.type].name : '';
addMsg(`PRIO ${p+1} -> ${name}`, 'info');
}
refreshBuildingPanel();
});
});

// Priority slots clickable from console (cycle through damaged buildings)
document.querySelectorAll('.pslot').forEach(slot => {
slot.addEventListener('click', () => {
const idx     = parseInt(slot.dataset.slot);
// Auto-assign most damaged un-prioritised defensive building
const damaged = G.buildings
.filter(b => b.hp < b.maxHp && b.hp > 0 && !G.priSlots.includes(b.id))
.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
if (damaged.length > 0) {
G.priSlots[idx] = damaged[0].id;
addMsg(`PRIO ${idx+1} -> ${BDEF[damaged[0].type].name}`, 'info');
} else {
G.priSlots[idx] = null;
}
});
});

// Boost buttons
document.getElementById('btn-eimer').addEventListener('click',    activateEimer);
document.getElementById('btn-steine').addEventListener('click',   activateSteine);
document.getElementById('btn-kriegsrat').addEventListener('click',activateKriegsrat);

// Restart button
document.getElementById('btn-restart').addEventListener('click', () => {
document.getElementById('overlay').classList.add('hidden');
_overlayShown = false;
G = createState();
addMsg('Neue Baronschaft begonnen!', 'good');
addMsg('Klicke auf Gebäude zum Ausbauen und zuweisen.', 'info');
});
}

function openBldgPanel(b) {
document.getElementById('bldgPanel').classList.remove('hidden');
refreshBuildingPanel();
}

function closeBldgPanel() {
document.getElementById('bldgPanel').classList.add('hidden');
}
