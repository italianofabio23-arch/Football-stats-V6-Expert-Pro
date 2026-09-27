"use strict";

// ==========================================
// FOOTBALL STATS V5 EXPERT
// BLOCCO 1 - Configurazione e controlli pagina
// ==========================================

const searchBtn = document.getElementById("searchBtn");
const resultsContainer = document.getElementById("resultsContainer");
const resultsInfo = document.getElementById("resultsInfo");
const matchesCount = document.getElementById("matchesCount");

const presetButtons = document.querySelectorAll(".preset");
const windowButtons = document.querySelectorAll(".window-btn");
const leagueCheckboxes = document.querySelectorAll(
  '.league-grid input[type="checkbox"]'
);

let selectedStrategy = "GG / BTTS";
let selectedDays = 1;

// Selezione strategia
presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    presetButtons.forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    selectedStrategy = button.textContent.trim();
  });
});

// Selezione finestra temporale
windowButtons.forEach((button) => {
  button.addEventListener("click", () => {
    windowButtons.forEach((btn) => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    selectedDays = Number(button.dataset.days) || 1;
  });
});
// Avvia la ricerca quando premi "Cerca partite"
searchBtn.addEventListener("click", async () => {
  showLoading();

  try {
    const selectedLeagues = getSelectedLeagues();

    if (!selectedLeagues.length) {
      showEmpty("Seleziona almeno un campionato.");
      return;
    }

    const games = await fetchAllFixtures();
    const filteredGames = filterSelectedLeagues(games);
    const normalizedMatches = normalizeFixtures(filteredGames);

    await renderMatches(normalizedMatches);

  } catch (error) {
    console.error("Errore ricerca partite:", error);

    showError(
      error?.message || "Errore durante il caricamento delle partite."
    );

  } finally {
    stopLoading();
  }
});
// Restituisce i campionati selezionati
function getSelectedLeagues() {
  return [...leagueCheckboxes]
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

// Conversione sicura in numero
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
                          }
// ==========================================
// BLOCCO 2 - Utility e gestione interfaccia
// ==========================================

// Protezione del testo inserito nell'HTML
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[char];
  });
}

// Limita una percentuale tra 0 e 100
function clampPercent(value) {
  return Math.max(
    0,
    Math.min(100, Math.round(safeNumber(value)))
  );
}

// Colore della percentuale
function percentClass(value) {
  const percent = clampPercent(value);

  if (percent >= 80) return "high";
  if (percent >= 65) return "medium";
  return "low";
}

// Formatta una data per la visualizzazione
function formatMatchDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Stato caricamento
function showLoading() {
  searchBtn.disabled = true;
  searchBtn.textContent = "⏳ Analisi in corso...";

  resultsInfo.textContent =
    `Analisi ${selectedStrategy} su ${selectedDays} ` +
    `${selectedDays === 1 ? "giorno" : "giorni"}...`;

  matchesCount.textContent = "0 partite";

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ⏳ Analisi delle partite in corso...
    </div>
  `;
}

// Ripristina il pulsante
function stopLoading() {
  searchBtn.disabled = false;
  searchBtn.textContent = "🔎 Cerca partite";
}

// Nessun risultato
function showEmpty(message) {
  matchesCount.textContent = "0 partite";
  resultsInfo.textContent = message;

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ${escapeHtml(message)}
    </div>
  `;
}

// Gestione errori
function showError(message) {
  matchesCount.textContent = "0 partite";
  resultsInfo.textContent = "Errore durante l'analisi.";

  resultsContainer.innerHTML = `
    <div class="empty-state">
      ❌ ${escapeHtml(message)}
    </div>
  `;
                             }
// ==========================================
// BLOCCO 3 - Schede risultati e percentuali
// ==========================================

function getStrategyKey() {
  const strategy = selectedStrategy.toLowerCase();

  if (strategy.includes("over")) return "over25";
  if (strategy.includes("under")) return "under25";
  if (strategy.includes("corner")) return "corners";
  if (strategy.includes("cartell")) return "cards";

  return "btts";
}

function getStrategyLabel() {
  const key = getStrategyKey();

  const labels = {
    btts: "GG / BTTS",
    over25: "Over 2.5",
    under25: "Under 2.5",
    corners: "Corner",
    cards: "Cartellini"
  };

  return labels[key] || "Pronostico";
}

function getMainProbability(match) {
  const key = getStrategyKey();

  if (!match.probabilities) return 0;

  return clampPercent(
    match.probabilities[key]
  );
}

function renderMarketBox(label, value) {
  const percent = clampPercent(value);

  return `
    <div class="market-box">
      <span>${escapeHtml(label)}</span>

      <div class="market-value ${percentClass(percent)}">
        ${percent}%
      </div>
    </div>
  `;
}
function renderXgBox(label, value) {
  const number = Number(value);

  const xg =
    Number.isFinite(number)
      ? number.toFixed(2)
      : "—";

  return `
    <div class="market-box">
      <span>${escapeHtml(label)}</span>

      <div class="market-value">
        ${xg}
      </div>
    </div>
  `;
}
function getExpertPrediction(probabilities, match = null) {
  if (!probabilities) {
    return {
      label: "Nessun pronostico",
      value: 0
    };
  }

  const options = [
    { label: "🏠 1 Casa", value: probabilities.homeWin },
    { label: "🤝 X Pareggio", value: probabilities.draw },
    { label: "✈️ 2 Ospite", value: probabilities.awayWin },
    { label: "⚽ GG / BTTS", value: probabilities.btts },
    { label: "🔥 Over 2.5", value: probabilities.over25 },
    { label: "🛡️ Under 2.5", value: probabilities.under25 }
  ];

  const best = options.reduce((best, current) => {
  return Number(current.value) > Number(best.value)
    ? current
    : best;
});

if (Number(best.value) < 65) {
  return {
    label: "⚠️ Nessun pronostico forte",
    value: best.value
  };
}

if (Number(best.value) >= 80) {
  const topConfidence = match
    ? calculateConfidenceScore(match, { value: best.value })
    : 0;

  if (topConfidence >= 80) {
    return {
      label: `🔥 TOP • ${best.label}`,
      value: best.value
    };
  }
}

if (Number(best.value) >= 70) {
  return {
    label: `🟠 Forte • ${best.label}`,
    value: best.value
  };
}

return {
  label: `🟡 Discreto • ${best.label}`,
  value: best.value
};
}
// ========================================
// V6 - CONFIDENCE SCORE 0-100
// ========================================
function calculateConfidenceScore(match, expertPrediction) {
  const probability = Number(expertPrediction?.value);

  if (!Number.isFinite(probability)) {
    return 0;
  }

  const data = match?.expertData || {};

  const homePlayed = Number(data.homePlayed) || 0;
  const awayPlayed = Number(data.awayPlayed) || 0;

  // Usa il campione più debole tra casa e trasferta
  const minPlayed = Math.min(homePlayed, awayPlayed);

  // Qualità campione:
  // poche partite = fiducia ridotta
  // da circa 8 partite in poi = campione forte
  const sampleScore = Math.min(
    100,
    40 + minPlayed * 7.5
  );

  const homeXg = Number(match?.xg?.home);
  const awayXg = Number(match?.xg?.away);

  let xgReliability = 100;

  if (
    !Number.isFinite(homeXg) ||
    !Number.isFinite(awayXg)
  ) {
    xgReliability = 40;
  } else {
    // Penalizza valori arrivati quasi ai limiti
    // di sicurezza del modello
    if (
      homeXg <= 0.16 ||
      awayXg <= 0.16 ||
      homeXg >= 4.49 ||
      awayXg >= 4.49
    ) {
      xgReliability -= 25;
    }
  }

  const leagueAverage = Number(data.leagueAverage);

  const leagueScore =
    Number.isFinite(leagueAverage) &&
    leagueAverage > 0
      ? 100
      : 50;

  // Probabilità pronostico = 55%
  // Quantità dati = 30%
  // Affidabilità xG = 10%
  // Dati campionato = 5%
  const confidence =
    probability * 0.55 +
    sampleScore * 0.30 +
    xgReliability * 0.10 +
    leagueScore * 0.05;

  return Math.max(
    0,
    Math.min(100, Math.round(confidence))
  );
}
  // ========================================
// V6 - FILTRO ANTI-FALSE TOP
// ========================================
function evaluateV6AntiFalse(expertPrediction, confidenceScore) {
  const probability = clampPercent(
    expertPrediction?.value
  );

  const confidence = clampPercent(
    confidenceScore
  );

  const baseScore = Math.min(
    probability,
    confidence
  );

  if (
    probability >= 80 &&
    confidence >= 80
  ) {
    return {
      status: "top",
      score: baseScore,
      label:
        `🔥 TOP CONFERMATO • ` +
        `P ${probability}% • C ${confidence}%`
    };
  }

  if (
    probability >= 80 ||
    confidence >= 80
  ) {
    const missing =
      probability < 80
        ? `${80 - probability}% P`
        : `${80 - confidence}% C`;

    return {
      status: "almost-top",
      score: baseScore,
      label:
        `🟠 QUASI TOP • ` +
        `P ${probability}% • C ${confidence}% • ` +
        `Manca ${missing}`
    };
  }

  return {
    status: "not-top",
    score: baseScore,
    label:
      `⚪ NON TOP • ` +
      `P ${probability}% • C ${confidence}%`
  };
}
// ==========================================
// V6 - BOX POSSIBILI MARCATORI
// ==========================================

function renderScorerCandidates(match) {
  const homeCandidates =
    Array.isArray(match?.scorerCandidates?.home)
      ? match.scorerCandidates.home
      : [];

  const awayCandidates =
    Array.isArray(match?.scorerCandidates?.away)
      ? match.scorerCandidates.away
      : [];
console.log("🔎 DEBUG MARCATORI", {
  partita: `${match.home} - ${match.away}`,
  scorerCandidates: match.scorerCandidates,
  casa: homeCandidates.length,
  ospite: awayCandidates.length
});
  const candidates = [
    ...homeCandidates,
    ...awayCandidates
  ]
    .sort(
      (a, b) =>
        Number(b.probability) -
        Number(a.probability)
    )
    .slice(0, 2);

  if (!candidates.length) {
    return `
      <div
        class="market-box"
        style="grid-column: 1 / -1;"
      >
        <span>⚽ POSSIBILI MARCATORI</span>

        <div class="market-value">
          ⚠️ Dati giocatori insufficienti
        </div>
      </div>
    `;
  }

  return `
    <div
      class="market-box"
      style="grid-column: 1 / -1;"
    >
      <span>⚽ POSSIBILI MARCATORI V6</span>

      ${candidates.map((player) => `
        <div
          style="
            margin-top:12px;
            padding-top:10px;
            border-top:1px solid var(--border);
          "
        >
          <div
            style="
              display:flex;
              justify-content:space-between;
              gap:10px;
              align-items:center;
            "
          >
            <strong>
              ${escapeHtml(
                player.name || "Giocatore"
              )}
            </strong>

            <strong
              class="market-value ${percentClass(
                player.probability
              )}"
            >
              ${clampPercent(
                player.probability
              )}%
            </strong>
          </div>

          <small>
            ${escapeHtml(
              player.teamName || ""
            )}
            • ${escapeHtml(
              player.teamSide || ""
            )}
            <br>

            🔥 Gol ultime ${player.appearances || 0}:
            ${Number(player.recentGoals) || 0}

            • 🎯 Tiri:
            ${Number(player.shots) || 0}

            • Tiri in porta:
            ${Number(player.shotsOn) || 0}

            <br>

            ⏱️ Media:
            ${Number(player.avgMinutes) || 0} min

            • 🤝 Gol H2H:
            ${Number(player.h2hGoals) || 0}

            • xG giocatore:
            ${Number(player.playerXg || 0).toFixed(2)}
          </small>
        </div>
      `).join("")}
    </div>
  `;
}
function renderMatchCard(match) {
  const home = escapeHtml(match.home || "Casa");
  const away = escapeHtml(match.away || "Ospite");
  const league = escapeHtml(match.league || "Campionato");
  const date = formatMatchDate(match.date);

  const probabilities = match.probabilities || {};

  const mainProbability = getMainProbability(match);
  const mainLabel = getStrategyLabel();
  const expertPrediction = getExpertPrediction(probabilities, match);
  const confidenceScore = calculateConfidenceScore(match, expertPrediction);
  const v6AntiFalse = evaluateV6AntiFalse(
  expertPrediction,
  confidenceScore
);
  return `
    <article class="match-card">

      <div class="match-top">
        <div class="match-league">
          ${league}
        </div>

        <div class="match-date">
          ${escapeHtml(date)}
        </div>
      </div>

      <div class="teams">
        ⚽ ${home} - ${away}
      </div>

      <div class="market-grid">
${renderMarketBox(
  `🔥 Pronostico Expert: ${expertPrediction.label}`,
  expertPrediction.value
)}
${renderMarketBox(
  "🎯 Confidence Score",
  confidenceScore
)}

        ${renderMarketBox(
          mainLabel,
          mainProbability
        )}
        <div class="market-box">
  <span>🛡️ Anti-False V6</span>

  <div class="market-value">
    ${escapeHtml(v6AntiFalse.label)}
  </div>

  <small>
    Score ${v6AntiFalse.score}/100
  </small>
</div>

      ${mainLabel !== "GG / BTTS"
  ? renderMarketBox("GG / BTTS", probabilities.btts)
  : ""}

${mainLabel !== "Over 2.5"
  ? renderMarketBox("Over 2.5", probabilities.over25)
  : ""}

<div class="stats-fixed-grid">

  <div class="stat-xg-home">
    ${renderXgBox("xG Casa", match.xg?.home)}
  </div>

  <div class="stat-draw">
    ${renderMarketBox("🤝 X Pareggio", probabilities.draw)}
  </div>

  <div class="stat-xg-away">
    ${renderXgBox("xG Ospite", match.xg?.away)}
  </div>

  <div class="stat-home">
    ${renderMarketBox("🏠 1 Casa", probabilities.homeWin)}
  </div>

  <div class="stat-away">
    ${renderMarketBox("✈️ 2 Ospite", probabilities.awayWin)}
  </div>

  ${mainLabel !== "Under 2.5"
    ? `<div class="stat-under">
        ${renderMarketBox("Under 2.5", probabilities.under25)}
       </div>`
    : ""}

</div>
${renderScorerCandidates(match)}
      </div>

    </article>
  `;
}
// ==========================================
// BLOCCO 4F - Collegamento xG -> Poisson
// ==========================================

async function enrichMatchWithExpertData(match) {
  try {
    // Il fixture originale API-Football è salvato in raw
    const sourceGame = match.raw || match;

    // Calcolo xG Casa / Ospite
    const xgData =
      await calculateExpectedGoals(sourceGame);

    // Se non abbiamo dati sufficienti,
    // lasciamo la partita invariata
    if (!xgData) {
      return match;
    }

    // Trasforma gli xG in probabilità Poisson
    const probabilities =
      calculatePoissonProbabilities(
        xgData.homeExpectedGoals,
        xgData.awayExpectedGoals
      );
    // ======================================
    // V6 - POSSIBILI MARCATORI
    // ======================================

    const homeTeamId =
      Number(sourceGame?.teams?.home?.id);

    const awayTeamId =
      Number(sourceGame?.teams?.away?.id);

    let scorerCandidates = {
      home: [],
      away: []
    };

    if (
      Number.isFinite(homeTeamId) &&
      Number.isFinite(awayTeamId)
    ) {
      const [
        homeRecentFixtures,
        awayRecentFixtures,
        h2hFixtures
      ] = await Promise.all([
        fetchScorerRecentFixtures(
          homeTeamId,
          5
        ),

        fetchScorerRecentFixtures(
          awayTeamId,
          5
        ),

        fetchScorerHeadToHead(
          homeTeamId,
          awayTeamId,
          5
        )
      ]);

      const [
        homeScorers,
        awayScorers
      ] = await Promise.all([
        buildScorerCandidates(
  homeTeamId,
  homeRecentFixtures,
  h2hFixtures,
  xgData.homeExpectedGoals,
  sourceGame?.league?.season
),

      buildScorerCandidates(
  awayTeamId,
  awayRecentFixtures,
  h2hFixtures,
  xgData.awayExpectedGoals,
  sourceGame?.league?.season
)
        
      ]);

      scorerCandidates = {
        home: homeScorers.map(
          (player) => ({
            ...player,
            teamSide: "Casa",
            teamName:
              sourceGame?.teams?.home?.name ||
              match.home
          })
        ),

        away: awayScorers.map(
          (player) => ({
            ...player,
            teamSide: "Ospite",
            teamName:
              sourceGame?.teams?.away?.name ||
              match.away
          })
        )
      };
  }
    return {
      ...match,

      probabilities,

      xg: {
        home: xgData.homeExpectedGoals,
        away: xgData.awayExpectedGoals
      },

scorerCandidates,
      expertData: xgData
    };

  } catch (error) {
    console.error(
      "Errore analisi V5:",
      error
    );

    return match;
  }
  }
async function renderMatches(matches) {
  if (!Array.isArray(matches) || !matches.length) {
    showEmpty(
      "Nessuna partita soddisfa i filtri selezionati."
    );
    return;
  }
resultsInfo.textContent = "🧠 Analisi Expert V5 in corso...";

const enrichedMatches = [];

for (let i = 0; i < matches.length; i += 4) {
  const batch = matches.slice(i, i + 4);

  const batchResults = await Promise.all(
    batch.map(enrichMatchWithExpertData)
  );

  enrichedMatches.push(...batchResults);
}

matches = enrichedMatches;
  matchesCount.textContent =
    `${matches.length} ${matches.length === 1 ? "partita" : "partite"}`;

  resultsInfo.textContent =
    `${getStrategyLabel()} • ${selectedDays} ` +
    `${selectedDays === 1 ? "giorno" : "giorni"} • ` +
    `${matches.length} risultati`;

  resultsContainer.innerHTML =
  renderTop80Slip(matches) +
  renderRiskyExpertSlip(matches) +
  matches.map(renderMatchCard).join("");
    }
function renderTop80Slip(matches) {
const picks = matches
  .map((match) => {
    const prediction =
      getExpertPrediction(match.probabilities, match);

    const confidenceScore =
      calculateConfidenceScore(match, prediction);

    const antiFalse =
      evaluateV6AntiFalse(
        prediction,
        confidenceScore
      );

    return {
      match,
      prediction,
      confidenceScore,
      antiFalse
    };
  })
  .filter(
    (item) =>
      item.antiFalse.status === "top"
  )
  .sort(
    (a, b) =>
      Number(b.antiFalse.score) -
        Number(a.antiFalse.score) ||
      Number(b.prediction.value) -
        Number(a.prediction.value)
  )
  .slice(0, 3);

  if (picks.length === 0) {
    return `
      <article class="match-card">
        <div class="teams">
          🔥 SCHEDINA TOP 80+
        </div>
        <div class="market-box">
          <span>Nessuna schedina TOP disponibile</span>
        </div>
      </article>
    `;
  }
const combinedTop80Odds = picks.reduce(
  (total, { prediction }) => {
    const probability = Number(prediction.value);

    if (!Number.isFinite(probability) || probability <= 0) {
      return total;
    }

    return total * (100 / probability);
  },
  1
);
  return `
    <article class="match-card">
      <div class="teams">
      ${picks.length === 1 ? "🔥 MIGLIORE TOP TROVATO" : "🔥 SCHEDINA TOP 80+"}
      </div>

      <div class="market-grid">
        ${picks.map(({ match, prediction, antiFalse }) => `
          <div class="market-box">
            <span>
              ${escapeHtml(match.home)} -
              ${escapeHtml(match.away)}
              <br>
              ${escapeHtml(prediction.label)}
              <br>
🛡️ Score Anti-False ${antiFalse.score}/100
            </span>

            <div class="market-value">
  ${clampPercent(prediction.value)}%
  <br>
  <span style="font-size:0.75em">
    Quota stimata ${(100 / Number(prediction.value)).toFixed(2)}
  </span>
</div>
          </div>
        `).join("")}
      </div>
      <div class="market-box" style="margin-top:16px;">
  <span>💰 Quota totale stimata</span>
  <div class="market-value">
    ${combinedTop80Odds.toFixed(2)}
  </div>
</div>
<div class="market-box" style="margin-top:12px;">
  <span>💶 Puntata</span>

  <input
    type="number"
    min="1"
    step="1"
    value="10"
    style="width:100%;margin:10px 0;padding:10px;border-radius:8px;"
    oninput="this.nextElementSibling.textContent='Vincita potenziale €' + ((Number(this.value) || 0) * ${Number(combinedTop80Odds.toFixed(2))}).toFixed(2)"
  >

  <div class="market-value">
    Vincita potenziale €${(10 * Number(combinedTop80Odds.toFixed(2))).toFixed(2)}
  </div>
</div>
    </article>
  `;
}
function teamOver05FromXg(xg) {
  const lambda = Number(xg);

  if (!Number.isFinite(lambda) || lambda <= 0) {
    return 0;
  }

  return clampPercent(
    (1 - Math.exp(-lambda)) * 100
  );
}

function teamOver15FromXg(xg) {
  const lambda = Number(xg);

  if (!Number.isFinite(lambda) || lambda <= 0) {
    return 0;
  }

  return clampPercent(
    (
      1 -
      Math.exp(-lambda) * (1 + lambda)
    ) * 100
  );
}
function renderRiskyExpertSlip(matches) {
  const candidates = matches
    .map((match) => {
      const p = match.probabilities || {};

      const homeXg = Number(match.xg?.home);
      const awayXg = Number(match.xg?.away);

      if (
        !Number.isFinite(homeXg) ||
        !Number.isFinite(awayXg)
      ) {
        return null;
      }

      const options = [];

      // =====================================
      // CASA OVER 1.5 GOL
      // solo con xG molto alto
      // =====================================
      if (homeXg >= 2.50) {
        const probability =
          teamOver15FromXg(homeXg);

        const confidence =
          calculateConfidenceScore(
            match,
            { value: probability }
          );

        if (
          probability >= 70 &&
          confidence >= 75
        ) {
          options.push({
            label: "🏠 Casa Over 1.5 Gol",
            value: probability,
            confidence,
            xg: homeXg,
            priority: 5
          });
        }
      }

      // =====================================
      // OSPITE OVER 1.5 GOL
      // solo con xG molto alto
      // =====================================
      if (awayXg >= 2.50) {
        const probability =
          teamOver15FromXg(awayXg);

        const confidence =
          calculateConfidenceScore(
            match,
            { value: probability }
          );

        if (
          probability >= 70 &&
          confidence >= 75
        ) {
          options.push({
            label: "✈️ Ospite Over 1.5 Gol",
            value: probability,
            confidence,
            xg: awayXg,
            priority: 5
          });
        }
      }

      // =====================================
      // CASA SEGNA OVER 0.5
      // =====================================
      if (homeXg >= 1.60) {
        const probability =
          teamOver05FromXg(homeXg);

        const confidence =
          calculateConfidenceScore(
            match,
            { value: probability }
          );

        if (
          probability >= 76 &&
          confidence >= 75
        ) {
          options.push({
            label: "🏠 Casa Over 0.5 Gol",
            value: probability,
            confidence,
            xg: homeXg,
            priority: 4
          });
        }
      }

      // =====================================
      // OSPITE SEGNA OVER 0.5
      // =====================================
      if (awayXg >= 1.60) {
        const probability =
          teamOver05FromXg(awayXg);

        const confidence =
          calculateConfidenceScore(
            match,
            { value: probability }
          );

        if (
          probability >= 76 &&
          confidence >= 75
        ) {
          options.push({
            label: "✈️ Ospite Over 0.5 Gol",
            value: probability,
            confidence,
            xg: awayXg,
            priority: 4
          });
        }
      }

      // =====================================
      // OVER 2.5 PARTITA
      // =====================================
      const over25 = Number(p.over25);

      if (Number.isFinite(over25)) {
        const confidence =
          calculateConfidenceScore(
            match,
            { value: over25 }
          );

        if (
          over25 >= 72 &&
          confidence >= 75
        ) {
          options.push({
            label: "🔥 Over 2.5",
            value: over25,
            confidence,
            xg: homeXg + awayXg,
            priority: 3
          });
        }
      }

      // =====================================
      // GG / BTTS
      // =====================================
      const btts = Number(p.btts);

      if (Number.isFinite(btts)) {
        const confidence =
          calculateConfidenceScore(
            match,
            { value: btts }
          );

        if (
          btts >= 70 &&
          confidence >= 75
        ) {
          options.push({
            label: "⚽ GG / BTTS",
            value: btts,
            confidence,
            xg: homeXg + awayXg,
            priority: 2
          });
        }
      }

      if (!options.length) {
        return null;
      }

      // Preferisce:
      // 1. mercati squadra con xG alto
      // 2. maggiore confidence
      // 3. maggiore probabilità
      options.sort(
        (a, b) =>
          b.priority - a.priority ||
          b.confidence - a.confidence ||
          b.value - a.value
      );

      return {
        match,
        prediction: options[0]
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.prediction.confidence -
          a.prediction.confidence ||
        b.prediction.priority -
          a.prediction.priority ||
        b.prediction.value -
          a.prediction.value
    );

  // Massimo 7 partite
  const picks = candidates.slice(0, 7);

  if (picks.length === 0) {
    return `
      <article class="match-card">
        <div class="teams">
          🎯 SCHEDINA MODERATA V6 • GOAL & xG
        </div>

        <div class="market-box">
          <span>
            Nessuna selezione con requisiti sufficienti
          </span>
        </div>
      </article>
    `;
  }

  const combinedEstimatedOdds =
    picks.reduce(
      (total, { prediction }) => {
        const probability =
          Number(prediction.value);

        if (
          !Number.isFinite(probability) ||
          probability <= 0
        ) {
          return total;
        }

        return total * (100 / probability);
      },
      1
    );

  return `
    <article class="match-card">

      <div class="teams">
        🎯 SCHEDINA MODERATA V6 • GOAL & xG
      </div>

      <div class="market-box"
           style="margin-bottom:14px;">
        <span>
          ${
            picks.length >= 6
              ? `✅ ${picks.length} selezioni trovate`
              : `⚠️ Solo ${picks.length} selezioni superano i filtri`
          }
        </span>
      </div>

      <div class="market-grid">

        ${picks.map(
          ({ match, prediction }) => `
          <div class="market-box">

            <span>
              ${escapeHtml(match.home)} -
              ${escapeHtml(match.away)}
              <br>

              ${escapeHtml(prediction.label)}
              <br>

              ⚽ xG ${Number(prediction.xg).toFixed(2)}
              <br>

              🎯 Confidence Gol
              ${prediction.confidence}%
            </span>

            <div class="market-value">

              ${clampPercent(
                prediction.value
              )}%

              <br>

              <span style="font-size:0.75em">
                Quota stimata
                ${(
                  100 /
                  Number(prediction.value)
                ).toFixed(2)}
              </span>

            </div>
          </div>
        `
        ).join("")}

      </div>

      <div
        class="market-box"
        style="margin-top:16px;"
      >
        <span>
          💰 Quota totale stimata
        </span>

        <div class="market-value">
          ${combinedEstimatedOdds.toFixed(2)}
        </div>
      </div>

      <div
        class="market-box"
        style="margin-top:12px;"
      >

        <span>💶 Puntata</span>

        <input
          type="number"
          min="1"
          step="1"
          value="10"
          style="width:100%;
                 margin:10px 0;
                 padding:10px;
                 border-radius:8px;"
          oninput="
            this.nextElementSibling.textContent =
            'Vincita potenziale €' +
            (
              (Number(this.value) || 0) *
              ${Number(
                combinedEstimatedOdds.toFixed(2)
              )}
            ).toFixed(2)
          "
        >

        <div class="market-value">
          Vincita potenziale €
          ${(
            10 *
            Number(
              combinedEstimatedOdds.toFixed(2)
            )
          ).toFixed(2)}
        </div>

      </div>

    </article>
  `;
}

// ==========================================
// BLOCCO 4A - Backend V4 e gestione date
// ==========================================

const BACKEND =
  "https://football-stats-v3.onrender.com";

const LEAGUE_NAMES = {
  SA: "Serie A",
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  FL1: "Ligue 1",
  FL2: "Ligue 2",
  NL1: "Eredivisie",
  NL2: "Eerste Divisie",
  PD2: "Segunda División",
  TR1: "Süper Lig",
  PT1: "Primeira Liga",
SC1: "Premiership",
SERIE_B: "Serie B",
  CL: "UEFA Champions League",
  EL: "UEFA Europa League",
  CH: "Championship"
};
// ==========================================
// V6 - DATI GIOCATORI / POSSIBILI MARCATORI
// ==========================================

const scorerRecentFixturesCache = new Map();
const scorerFixturePlayersCache = new Map();
const scorerH2HCache = new Map();

// Ultime partite concluse di una squadra
async function fetchScorerRecentFixtures(teamId, last = 5) {
  const id = Number(teamId);
  const limit = Math.max(1, Math.min(10, Number(last) || 5));

  if (!Number.isFinite(id) || id <= 0) {
    return [];
  }

  const cacheKey = `${id}-${limit}`;

  if (scorerRecentFixturesCache.has(cacheKey)) {
    return scorerRecentFixturesCache.get(cacheKey);
  }

  try {
    const url =
      `${BACKEND}/api/football?path=/fixtures` +
      `&team=${id}&last=${limit}&status=FT`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const fixtures = Array.isArray(data.response)
      ? data.response
      : [];

    scorerRecentFixturesCache.set(cacheKey, fixtures);

    return fixtures;

  } catch (error) {
    console.warn(
      "Errore ultime partite marcatore:",
      id,
      error
    );

    return [];
  }
}

// Statistiche giocatori di una singola partita
async function fetchScorerFixturePlayers(fixtureId) {
  const id = Number(fixtureId);

  if (!Number.isFinite(id) || id <= 0) {
    return [];
  }

  if (scorerFixturePlayersCache.has(id)) {
    return scorerFixturePlayersCache.get(id);
  }

  try {
    const url =
      `${BACKEND}/api/football?path=/fixtures/players` +
      `&fixture=${id}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const players = Array.isArray(data.response)
      ? data.response
      : [];

    scorerFixturePlayersCache.set(id, players);

    return players;

  } catch (error) {
    console.warn(
      "Errore dati giocatori:",
      id,
      error
    );

    return [];
  }
}

// Ultimi scontri diretti fra le due squadre
async function fetchScorerHeadToHead(
  homeTeamId,
  awayTeamId,
  last = 5
) {
  const homeId = Number(homeTeamId);
  const awayId = Number(awayTeamId);

  if (
    !Number.isFinite(homeId) ||
    !Number.isFinite(awayId)
  ) {
    return [];
  }

  const cacheKey =
    `${homeId}-${awayId}-${last}`;

  if (scorerH2HCache.has(cacheKey)) {
    return scorerH2HCache.get(cacheKey);
  }

  try {
    const url =
      `${BACKEND}/api/football?path=/fixtures/headtohead` +
      `&h2h=${homeId}-${awayId}` +
      `&last=${last}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    const fixtures = Array.isArray(data.response)
      ? data.response
      : [];

    scorerH2HCache.set(cacheKey, fixtures);

    return fixtures;

  } catch (error) {
    console.warn(
      "Errore H2H marcatori:",
      homeId,
      awayId,
      error
    );

    return [];
  }
  }
// ==========================================
// V6 - MOTORE POSSIBILE MARCATORE
// ==========================================

// Estrae i dati offensivi dei giocatori
// da una singola partita
function extractScorerPlayerStats(playerData, teamId) {
  const teams = Array.isArray(playerData)
    ? playerData
    : [];

  const teamBlock = teams.find(
    (item) =>
      Number(item?.team?.id) === Number(teamId)
  );

  const players = Array.isArray(teamBlock?.players)
    ? teamBlock.players
    : [];

  return players
    .map((entry) => {
      const stats =
        Array.isArray(entry?.statistics)
          ? entry.statistics[0] || {}
          : {};

      const playerId =
        Number(entry?.player?.id);

      if (!Number.isFinite(playerId)) {
        return null;
      }

      return {
        id: playerId,

        name:
          entry?.player?.name ||
          "Giocatore",

        position:
          String(
            stats?.games?.position || ""
          ).toUpperCase(),

        minutes:
          safeNumber(
            stats?.games?.minutes
          ),

        rating:
          safeNumber(
            stats?.games?.rating
          ),

        goals:
          safeNumber(
            stats?.goals?.total
          ),

        shots:
          safeNumber(
            stats?.shots?.total
          ),

        shotsOn:
          safeNumber(
            stats?.shots?.on
          )
      };
    })
    .filter(Boolean);
}


// ==========================================
// COSTRUISCE I CANDIDATI MARCATORE
// ==========================================

async function buildScorerCandidates(
  teamId,
  recentFixtures,
  h2hFixtures,
  teamExpectedGoals,
  season
) {
  const id = Number(teamId);
  const teamXg = Number(teamExpectedGoals);
  const seasonYear = Number(season);

  if (
    !Number.isFinite(id) ||
    !Number.isFinite(teamXg) ||
    teamXg <= 0
  ) {
    return [];
  }

  const recent = Array.isArray(recentFixtures)
    ? recentFixtures.slice(0, 5)
    : [];
console.log("🔎 DEBUG RECENT MARCATORI", {
  teamId: id,
  recentFixturesRicevute: recentFixtures,
  recentUsate: recent,
  numeroPartite: recent.length
});


  const playerMap = new Map();

  // ======================================
  // ANALISI ULTIME 5 PARTITE
  // ======================================

  const recentResults = await Promise.all(
    recent.map(async (fixture) => {
      const fixtureId = Number(
        fixture?.fixture?.id ??
        fixture?.id
      );

      if (!Number.isFinite(fixtureId)) {
        return [];
      }

      const playerData =
        await fetchScorerFixturePlayers(
          fixtureId
        );

      return extractScorerPlayerStats(
        playerData,
        id
      );
    })
  );

  recentResults
    .flat()
    .forEach((player) => {
      if (!player?.id) return;

      if (!playerMap.has(player.id)) {
        playerMap.set(player.id, {
          id: player.id,
          name: player.name,
          position: player.position,
          appearances: 0,
          minutes: 0,
          goals: 0,
          shots: 0,
          shotsOn: 0,
          ratingTotal: 0,
          ratingCount: 0,
          h2hGoals: 0
        });
      }

      const current =
        playerMap.get(player.id);

      if (player.minutes > 0) {
        current.appearances += 1;
      }

      current.minutes +=
        safeNumber(player.minutes);

      current.goals +=
        safeNumber(player.goals);

      current.shots +=
        safeNumber(player.shots);

      current.shotsOn +=
        safeNumber(player.shotsOn);

      if (player.rating > 0) {
        current.ratingTotal +=
          player.rating;

        current.ratingCount += 1;
      }

      if (
        !current.position &&
        player.position
      ) {
        current.position =
          player.position;
      }
    });
  // ======================================
// FALLBACK DATI STAGIONALI GIOCATORI
// ======================================

const usableRecentPlayers =
  Array.from(playerMap.values()).filter((player) => {
    const position =
      String(player.position || "").toUpperCase();

    const isGoalkeeper =
      position === "G" ||
      position.includes("GK") ||
      position.includes("GOALKEEP");

    return (
      !isGoalkeeper &&
      player.appearances >= 1 &&
      player.minutes >= 45
    );
  });

if (
  usableRecentPlayers.length < 2 &&
  Number.isFinite(seasonYear) &&
  typeof fetchScorerSeasonPlayers === "function"
) {
  const seasonPlayers =
    await fetchScorerSeasonPlayers(
      id,
      seasonYear
    );

  seasonPlayers.forEach((entry) => {
    const playerId =
      Number(entry?.player?.id);

    if (
      !Number.isFinite(playerId) ||
      playerMap.has(playerId)
    ) {
      return;
    }

    const statsList =
      Array.isArray(entry?.statistics)
        ? entry.statistics
        : [];

    const stats =
      statsList.find(
        (item) =>
          Number(item?.team?.id) === id
      ) ||
      statsList[0] ||
      {};

    const appearances =
      safeNumber(
        stats?.games?.appearences ??
        stats?.games?.appearances
      );

    const minutes =
      safeNumber(stats?.games?.minutes);

    const rating =
      safeNumber(stats?.games?.rating);

    playerMap.set(playerId, {
      id: playerId,

      name:
        entry?.player?.name ||
        "Giocatore",

      position:
        String(
          stats?.games?.position || ""
        ).toUpperCase(),

      appearances,
      minutes,

      goals:
        safeNumber(stats?.goals?.total),

      shots:
        safeNumber(stats?.shots?.total),

      shotsOn:
        safeNumber(stats?.shots?.on),

      ratingTotal:
        rating > 0 ? rating : 0,

      ratingCount:
        rating > 0 ? 1 : 0,

      h2hGoals: 0
    });
  });
}


  // ======================================
  // ANALISI SCONTRI DIRETTI
  // ======================================

  const h2h = Array.isArray(h2hFixtures)
    ? h2hFixtures.slice(0, 5)
    : [];

  const h2hResults = await Promise.all(
    h2h.map(async (fixture) => {
      const fixtureId = Number(
        fixture?.fixture?.id ??
        fixture?.id
      );

      if (!Number.isFinite(fixtureId)) {
        return [];
      }

      const playerData =
        await fetchScorerFixturePlayers(
          fixtureId
        );

      return extractScorerPlayerStats(
        playerData,
        id
      );
    })
  );

  h2hResults
    .flat()
    .forEach((player) => {
      const current =
        playerMap.get(player.id);

      if (!current) return;

      current.h2hGoals +=
        safeNumber(player.goals);
    });


  // ======================================
  // FILTRO GIOCATORI UTILIZZABILI
  // ======================================

  const candidates =
    Array.from(playerMap.values())
      .filter((player) => {
        const position =
          String(player.position || "");

        const isGoalkeeper =
          position === "G" ||
          position.includes("GK") ||
          position.includes("GOALKEEP");

        return (
  !isGoalkeeper &&
  player.appearances >= 1 &&
  player.minutes >= 45
);
      })
      .map((player) => {
        const avgMinutes =
          player.appearances > 0
            ? player.minutes /
              player.appearances
            : 0;

        const avgRating =
          player.ratingCount > 0
            ? player.ratingTotal /
              player.ratingCount
            : 0;

        let positionFactor = 0.90;

        if (
          player.position.includes("F") ||
          player.position.includes("ATT")
        ) {
          positionFactor = 1.18;

        } else if (
          player.position.includes("M") ||
          player.position.includes("MID")
        ) {
          positionFactor = 1.00;

        } else if (
          player.position.includes("D") ||
          player.position.includes("DEF")
        ) {
          positionFactor = 0.58;
        }

        // Peso offensivo del giocatore
        const rawWeight =
          (
            1 +
            player.goals * 2.20 +
            player.shotsOn * 0.70 +
            player.shots * 0.18 +
            Math.min(
              1.2,
              avgMinutes / 90
            ) * 0.45 +
            Math.max(
              0,
              avgRating - 6
            ) * 0.25 +
            player.h2hGoals * 0.70
          ) *
          positionFactor;

        return {
          ...player,
          avgMinutes:
            Math.round(avgMinutes),

          avgRating:
            Number(
              avgRating.toFixed(2)
            ),

          rawWeight
        };
      });


  if (!candidates.length) {
    return [];
  }


  // ======================================
  // DISTRIBUZIONE xG SQUADRA AI GIOCATORI
  // ======================================

  const totalWeight =
    candidates.reduce(
      (sum, player) =>
        sum + player.rawWeight,
      0
    );

  if (totalWeight <= 0) {
    return [];
  }


  return candidates
    .map((player) => {

      const playerShare =
        player.rawWeight /
        totalWeight;

      let playerExpectedGoals =
        teamXg * playerShare;

      // Bonus prudente H2H
      const h2hBonus =
        Math.min(
          1.25,
          1 +
          player.h2hGoals * 0.08
        );

      playerExpectedGoals *=
        h2hBonus;

      // Poisson:
      // probabilità almeno 1 gol
      const probability =
        (
          1 -
          Math.exp(
            -playerExpectedGoals
          )
        ) * 100;

      return {
        id: player.id,
        name: player.name,
        position: player.position,

        probability:
          clampPercent(probability),

        playerXg:
          Number(
            playerExpectedGoals.toFixed(2)
          ),

        recentGoals:
          player.goals,

        shots:
          player.shots,

        shotsOn:
          player.shotsOn,

        appearances:
          player.appearances,

        avgMinutes:
          player.avgMinutes,

        avgRating:
          player.avgRating,

        h2hGoals:
          player.h2hGoals
      };
    })

    // Evita percentuali troppo deboli
    .filter(
      (player) =>
        player.probability >= 15
    )

    .sort(
      (a, b) =>
        b.probability -
        a.probability
    )

    // Massimo 2 possibili marcatori
    .slice(0, 2);
                               }
// Data YYYY-MM-DD senza problemi di fuso orario
function formatApiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Crea le date da oggi fino al numero di giorni scelto
function getSearchDates() {
  const dates = [];
  const today = new Date();

  for (let i = 0; i < selectedDays; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    dates.push(formatApiDate(date));
  }

  return dates;
}

// Nomi dei campionati selezionato 
function getSelectedLeagueNames() {
  return getSelectedLeagues()
    .map((code) => LEAGUE_NAMES[code])
    .filter(Boolean);
}

// Scarica le partite di una singola data
async function fetchFixturesByDate(date) {
  const url =
`${BACKEND}/api/football?path=/fixtures&date=${date}`;

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Errore API ${response.status} per ${date}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.response)
  ? data.response
  : [];
}

// Scarica tutte le partite della finestra selezionata
async function fetchAllFixtures() {
  const dates = getSearchDates();

  const responses = await Promise.all(
    dates.map((date) => fetchFixturesByDate(date))
  );

  return responses.flat();
}

// Filtra solo i campionati scelti
function filterSelectedLeagues(games) {
  const selected = getSelectedLeagueNames();

  if (!selected.length) {
    return [];
  }

  return games.filter((game) => {
    const leagueName = String(
  game.competition?.name ||
  game.league?.name ||
  game.league ||
  ""
).trim();

    return selected.includes(leagueName);
  });
    }
// ==========================================
// BLOCCO 4B - Normalizzazione dati partite
// ==========================================

function normalizeFixture(game) {
  return {
    raw: game,

    home:
      game.homeTeam?.name ||
      game.teams?.home?.name ||
      game.home ||
      "Casa",

    away:
      game.awayTeam?.name ||
      game.teams?.away?.name ||
      game.away ||
      "Ospite",

    league:
      game.competition?.name ||
      game.league?.name ||
      game.league ||
      "Campionato",

    date:
      game.utcDate ||
      game.fixture?.date ||
      game.date ||
      "",

    status:
      game.status ||
      game.fixture?.status?.short ||
      ""
  };
}

function normalizeFixtures(games) {
  if (!Array.isArray(games)) {
    return [];
  }

  return games.map(normalizeFixture);
}
// ==========================================
// BLOCCO 4C - Motore matematico Poisson
// ==========================================

// Fattoriale
function factorial(n) {
  if (n <= 1) return 1;

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

// Probabilità di segnare esattamente N gol
function poissonProbability(goals, lambda) {
  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial(goals)
  );
}

// Calcolo completo delle probabilità
function calculatePoissonProbabilities(
  homeExpectedGoals,
  awayExpectedGoals
) {
  const homeLambda = Math.max(
    0.05,
    Math.min(6, safeNumber(homeExpectedGoals))
  );

  const awayLambda = Math.max(
    0.05,
    Math.min(6, safeNumber(awayExpectedGoals))
  );

  const totalLambda = homeLambda + awayLambda;

  // GG / BTTS
  const bttsProbability =
    1 -
    Math.exp(-homeLambda) -
    Math.exp(-awayLambda) +
    Math.exp(-totalLambda);

  // Under 1.5
  const under15Probability =
    Math.exp(-totalLambda) *
    (1 + totalLambda);

  // Under 2.5
  const under25Probability =
    Math.exp(-totalLambda) *
    (
      1 +
      totalLambda +
      Math.pow(totalLambda, 2) / 2
    );

  const over15Probability =
    1 - under15Probability;

  const over25Probability =
    1 - under25Probability;

  // 1X2
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  const MAX_GOALS = 10;

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals++) {
    const homeProbability =
      poissonProbability(homeGoals, homeLambda);

    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals++) {
      const awayProbability =
        poissonProbability(awayGoals, awayLambda);

      const probability =
        homeProbability * awayProbability;

      if (homeGoals > awayGoals) {
        homeWin += probability;
      } else if (homeGoals === awayGoals) {
        draw += probability;
      } else {
        awayWin += probability;
      }
    }
  }

  const resultTotal =
    homeWin + draw + awayWin;

  if (resultTotal > 0) {
    homeWin /= resultTotal;
    draw /= resultTotal;
    awayWin /= resultTotal;
  }

  return {
    homeExpectedGoals: homeLambda,
    awayExpectedGoals: awayLambda,

    btts: clampPercent(
      bttsProbability * 100
    ),

    over15: clampPercent(
      over15Probability * 100
    ),

    over25: clampPercent(
      over25Probability * 100
    ),

    under25: clampPercent(
      under25Probability * 100
    ),

    homeWin: clampPercent(
      homeWin * 100
    ),

    draw: clampPercent(
      draw * 100
    ),

    awayWin: clampPercent(
      awayWin * 100
    )
  };
}
// ==========================================
// BLOCCO 4D - Classifica e forma squadre
// ==========================================

const standingsCache = {};
const standingsPending = {};
// Scarica la classifica del campionato
async function fetchStandings(leagueId, season) {
  const emptyStandings = {
    total: [],
    home: [],
    away: []
  };

  if (!leagueId || !season) {
    return emptyStandings;
  }

  const key = `${leagueId}-${season}`;

  if (standingsCache[key]) {
    return standingsCache[key];
  }

  if (standingsPending[key]) {
    return standingsPending[key];
  }

  standingsPending[key] = (async () => {
    try {
      const url =
        `${BACKEND}/api/football?path=/standings` +
        `&league=${leagueId}&season=${season}`;

      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        console.warn(
          "Standings API errore:",
          leagueId,
          season,
          response.status
        );
        return emptyStandings;
      }

      const data = await response.json();

let total = [];
let home = [];
let away = [];

// Formato già usato dalla V6
const oldStandings =
  Array.isArray(data.standings)
    ? data.standings
    : [];

if (oldStandings.length) {
  total =
    oldStandings.find((s) => s.type === "TOTAL")?.table ||
    oldStandings[0]?.table ||
    [];

  home =
    oldStandings.find((s) => s.type === "HOME")?.table ||
    total;

  away =
    oldStandings.find((s) => s.type === "AWAY")?.table ||
    total;
}

// Formato API-Football
if (!total.length) {
  const apiGroups =
    data?.response?.[0]?.league?.standings;

  const apiRows =
    Array.isArray(apiGroups)
      ? apiGroups.flat()
      : [];

  const convertRows = (mode) =>
    apiRows.map((row) => {
      const stats =
        row?.[mode] ||
        row?.all ||
        {};

      return {
        team: row?.team,
        playedGames: safeNumber(stats?.played),
        goalsFor: safeNumber(stats?.goals?.for),
        goalsAgainst: safeNumber(stats?.goals?.against),
        form: row?.form || ""
      };
    });

  total = convertRows("all");
  home = convertRows("home");
  away = convertRows("away");
}

const standings = {
  total,
  home,
  away
};

      if (total.length) {
        standingsCache[key] = standings;
      }

      return standings;

    } catch (error) {
      console.error("Errore fetchStandings:", error);
      return emptyStandings;

    } finally {
      delete standingsPending[key];
    }
  })();

  return standingsPending[key];
  }


// Converte la forma recente in valore 0-1
function calculateFormScore(form) {
  const results = String(form || "")
    .replace(/,/g, "")
    .slice(-5);

  if (!results) {
    return 0.5;
  }

  let points = 0;

  for (const result of results) {
    if (result === "W") {
      points += 3;
    } else if (result === "D") {
      points += 1;
    }
  }

  return points / (results.length * 3);
}


// Media corretta con smoothing
function smoothGoalRate(
  value,
  played,
  leagueAverage,
  priorGames = 5
) {
  return (
    safeNumber(value) +
    leagueAverage * priorGames
  ) / (
    safeNumber(played) + priorGames
  );
                           }
// ==========================================
// BLOCCO 4E - Calcolo xG Casa / Ospite
// ==========================================

// Normalizza il nome di una squadra
function normalizeTeamName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}


// Trova una squadra nella classifica
function findStandingTeam(standings, team) {
  if (!Array.isArray(standings) || !team) {
    return null;
  }

  const teamId = safeNumber(team.id);
  const teamName = normalizeTeamName(team.name);

  return standings.find((row) => {
    const rowId = safeNumber(row.team?.id);
    const rowName = normalizeTeamName(row.team?.name);

    if (teamId && rowId === teamId) {
      return true;
    }

    return teamName && rowName === teamName;
  }) || null;
}


// Media gol del campionato
function calculateLeagueGoalAverage(standings) {
  let totalGoals = 0;
  let totalPlayed = 0;

  for (const row of standings) {
    totalGoals += safeNumber(
      row.goalsFor
    );

    totalPlayed += safeNumber(
      row.playedGames
    );
  }

  if (!totalPlayed) {
    return 1.35;
  }

  const average =
    totalGoals / totalPlayed;

  return Math.max(
    0.8,
    Math.min(2.2, average)
  );
}


// Calcola gli Expected Goals
async function calculateExpectedGoals(game) {

  const leagueId =
    game.league?.id;

  const season =
    game.league?.season;

  const homeTeam =
    game.teams?.home;

  const awayTeam =
    game.teams?.away;

  if (
    !leagueId ||
    !season ||
    !homeTeam ||
    !awayTeam
  ) {
    return null;
  }

  const standingsData =
  await fetchStandings(
    leagueId,
    season
  );

const totalStandings =
  standingsData?.total || [];

const homeStandings =
  standingsData?.home || totalStandings;

const awayStandings =
  standingsData?.away || totalStandings;

if (!totalStandings.length) {
  return null;
}

const homeRow =
  findStandingTeam(
    homeStandings,
    homeTeam
  ) ||
  findStandingTeam(
    totalStandings,
    homeTeam
  );

const awayRow =
  findStandingTeam(
    awayStandings,
    awayTeam
  ) ||
  findStandingTeam(
    totalStandings,
    awayTeam
  );

if (!homeRow || !awayRow) {
  return null;
}

const homeTotalRow =
  findStandingTeam(
    totalStandings,
    homeTeam
  ) || homeRow;

const awayTotalRow =
  findStandingTeam(
    totalStandings,
    awayTeam
  ) || awayRow;

const leagueAverage =
  calculateLeagueGoalAverage(
    totalStandings
  );


  // CASA
  const homePlayed =
    safeNumber(
      homeRow.playedGames
    );

  const homeGF =
    safeNumber(
      homeRow.goalsFor
    );

  const homeGA =
    safeNumber(
      homeRow.goalsAgainst
    );


  // OSPITE
  const awayPlayed =
    safeNumber(
      awayRow.playedGames
    );

  const awayGF =
    safeNumber(
      awayRow.goalsFor
    );

  const awayGA =
    safeNumber(
      awayRow.goalsAgainst
    );


  // Medie con smoothing
  const homeAttack =
    smoothGoalRate(
      homeGF,
      homePlayed,
      leagueAverage
    );

  const homeDefense =
    smoothGoalRate(
      homeGA,
      homePlayed,
      leagueAverage
    );

  const awayAttack =
    smoothGoalRate(
      awayGF,
      awayPlayed,
      leagueAverage
    );

  const awayDefense =
    smoothGoalRate(
      awayGA,
      awayPlayed,
      leagueAverage
    );


  // Forma ultime 5
  const homeForm =
    calculateFormScore(
      homeTotalRow.form
    );

  const awayForm =
    calculateFormScore(
      awayTotalRow.form
    );


  const homeFormFactor =
    0.90 + homeForm * 0.20;

  const awayFormFactor =
    0.90 + awayForm * 0.20;


  // xG stimati
  let homeExpectedGoals =
    leagueAverage *
    (homeAttack / leagueAverage) *
    (awayDefense / leagueAverage) *
    1.00 *
    homeFormFactor;

  let awayExpectedGoals =
    leagueAverage *
    (awayAttack / leagueAverage) *
    (homeDefense / leagueAverage) *
    1.00 *
    awayFormFactor;


  // Limiti di sicurezza
  homeExpectedGoals =
    Math.max(
      0.15,
      Math.min(4.5, homeExpectedGoals)
    );

  awayExpectedGoals =
    Math.max(
      0.15,
      Math.min(4.5, awayExpectedGoals)
    );


  return {
  homeExpectedGoals,
  awayExpectedGoals,
  homeForm,
  awayForm,
  leagueAverage,
  homePlayed,
  awayPlayed
};
}
