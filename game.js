/**
 * Hauptobjekt des Spiels. Beinhaltet die Logik, Daten und Game-Loop.
 */
const game = {
    // Spielzustände (State Machine)
    STATES: {
        PEACE: 'Frieden (Produktion)',
        SIEGE: 'Belagerung (Verteidigung & Reparatur)'
    },
    currentState: 'Frieden (Produktion)',

    // Der aktuelle Ressourcenbestand des Spielers
    resources: {
        wood: 0,
        stone: 0,
        food: 0
    },

    // Gebäude-Datenstruktur: Enthält Level, Basis-Kosten und Produktionsrate
    buildings: {
        woodcutter: { level: 1, baseCost: 10, productionRate: 1 }, // Produziert 1 Holz pro Tick
        mason: { level: 1, baseCost: 15, productionRate: 0.5 }     // Produziert 0.5 Stein pro Tick
    },

    // Speichert den Zeitstempel des letzten Ticks für die Game-Loop
    lastTick: Date.now(),

    /**
     * Initialisiert das Spiel und startet die Schleife.
     */
    init: function() {
        console.log("Das Dekret des Baumeisters wurde erlassen. Spiel startet!");
        requestAnimationFrame(this.gameLoop.bind(this));
    },

    /**
     * Die Haupt-Spielschleife (Core Loop). Wird vom Browser so oft wie möglich aufgerufen.
     */
    gameLoop: function() {
        const now = Date.now();
        const deltaTime = (now - this.lastTick) / 1000; // Zeitdifferenz in Sekunden

        // Führe die Produktionslogik nur aus, wenn mindestens 1 Sekunde vergangen ist
        if (deltaTime >= 1) {
            this.produceResources();
            this.updateUI();
            this.lastTick = now;
        }

        // Ruft die Loop kontinuierlich wieder auf
        requestAnimationFrame(this.gameLoop.bind(this));
    },

    /**
     * Berechnet die hinzukommenden Ressourcen basierend auf dem aktuellen Gebäude-Level.
     */
    produceResources: function() {
        if (this.currentState === this.STATES.PEACE) {
            this.resources.wood += this.buildings.woodcutter.level * this.buildings.woodcutter.productionRate;
            this.resources.stone += this.buildings.mason.level * this.buildings.mason.productionRate;
        }
    },

    /**
     * Mathematische Upgrade-Formel: C(L) = BaseCost * 1.15^L
     * @param {string} buildingId - Die ID des Gebäudes (z.B. 'woodcutter')
     * @returns {number} Die abgerundeten Kosten für das nächste Level.
     */
    calculateUpgradeCost: function(buildingId) {
        const b = this.buildings[buildingId];
        return Math.floor(b.baseCost * Math.pow(1.15, b.level));
    },

    /**
     * Wird aufgerufen, wenn der Spieler auf den "Upgrade"-Button klickt.
     * @param {string} buildingId - Die ID des zu verbessernden Gebäudes.
     */
    upgradeBuilding: function(buildingId) {
        const cost = this.calculateUpgradeCost(buildingId);
        
        // Prüfe, ob genügend Ressourcen vorhanden sind und ziehe sie ab
        if (buildingId === 'woodcutter' && this.resources.wood >= cost) {
            this.resources.wood -= cost;
            this.buildings.woodcutter.level++;
        } else if (buildingId === 'mason' && this.resources.stone >= cost) {
            this.resources.stone -= cost;
            this.buildings.mason.level++;
        } else {
            console.log("Nicht genug Ressourcen, mein Lord!");
        }
        
        // Aktualisiere die Benutzeroberfläche sofort nach einem Kauf
        this.updateUI();
    },

    /**
     * Aktualisiert alle HTML-Elemente mit den neuesten Daten aus dem JavaScript-Objekt.
     */
    updateUI: function() {
        // Ressourcen aktualisieren (abgerundet für eine saubere Anzeige)
        document.getElementById('res-wood').innerText = Math.floor(this.resources.wood);
        document.getElementById('res-stone').innerText = Math.floor(this.resources.stone);
        
        // Gebäude-Level aktualisieren
        document.getElementById('lvl-woodcutter').innerText = this.buildings.woodcutter.level;
        document.getElementById('lvl-mason').innerText = this.buildings.mason.level;

        // Kosten für das nächste Upgrade aktualisieren
        document.getElementById('cost-woodcutter').innerText = this.calculateUpgradeCost('woodcutter');
        document.getElementById('cost-mason').innerText = this.calculateUpgradeCost('mason');

        // Status-Text aktualisieren
        document.getElementById('gameState').innerText = `Zustand: ${this.currentState}`;
    }
};

// Startet das Spiel, sobald die HTML-Datei vollständig im Browser geladen wurde
window.onload = function() {
    game.init();
};
