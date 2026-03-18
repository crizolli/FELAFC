const statsGrid = document.querySelector("#stats-grid");
const playerHistoryGrid = document.querySelector("#player-history-grid");
const playerImages = {
  Breno: "breno.png",
  Glik: "glik.png",
  Joao: "joao.png",
  Caio: "caio.png"
};
const playerImagePositions = {
  Breno: "center 24%",
  Glik: "center top",
  Joao: "center 20%",
  Caio: "center top"
};

if (statsGrid) {
  renderStats();
}

async function renderStats() {
  if (!window.FelasSupabase?.isConfigured) {
    renderStatsState("Supabase nao configurado.", "Preencha o arquivo supabase-config.js para carregar as estatisticas.");
    return;
  }

  try {
    const newsItems = await window.FelasSupabase.fetchPublishedNews();
    const ratedNewsItems = newsItems.filter((item) => isPartidasCategory(item.category));

    if (!ratedNewsItems.length) {
      renderStatsState("Sem dados ainda", "Publique noticias com notas para alimentar as estatisticas automaticamente.");
      renderHistoryState("Publique notícias com notas para montar o histórico dos jogadores.");
      return;
    }

    const stats = buildStats(ratedNewsItems);
    statsGrid.innerHTML = stats.map(createStatCardMarkup).join("");
    renderPlayerHistory(ratedNewsItems);
  } catch (error) {
    renderStatsState("Erro ao carregar", "Nao foi possivel buscar as estatisticas no Supabase agora.");
    renderHistoryState("Nao foi possível carregar o histórico das notas agora.");
  }
}

function renderStatsState(label, description) {
  statsGrid.innerHTML = `
    <article class="stat-card">
      <span class="stat-label">${window.FelasNewsData.escapeHtml(label)}</span>
      <strong>--</strong>
      <p>${window.FelasNewsData.escapeHtml(description)}</p>
    </article>
  `;
}

function renderHistoryState(message) {
  if (!playerHistoryGrid) {
    return;
  }

  playerHistoryGrid.innerHTML = `
    <article class="player-history-card">
      <p class="empty-state">${window.FelasNewsData.escapeHtml(message)}</p>
    </article>
  `;
}

function buildStats(newsItems) {
  const ratedMatches = newsItems.filter((item) => Array.isArray(item.ratings) && item.ratings.length);
  const playerNames = ["Breno", "Glik", "Joao", "Caio"];
  const playerTotals = Object.fromEntries(playerNames.map((name) => [name, { sum: 0, count: 0, absences: 0, best: 0 }]));

  ratedMatches.forEach((item) => {
    item.ratings.forEach((rating) => {
      const bucket = playerTotals[rating.name];
      if (!bucket) {
        return;
      }

      const value = Number(String(rating.value || "").replace(",", "."));
      if (!Number.isFinite(value)) {
        return;
      }

      bucket.sum += value;
      bucket.count += 1;
      bucket.best = Math.max(bucket.best, value);

      if (value <= 0) {
        bucket.absences += 1;
      }
    });
  });

  const bestAveragePlayer = playerNames
    .map((name) => ({
      name,
      average: playerTotals[name].count ? playerTotals[name].sum / playerTotals[name].count : 0
    }))
    .sort((a, b) => b.average - a.average)[0];

  const bestSingleNote = playerNames
    .map((name) => ({
      name,
      best: playerTotals[name].best
    }))
    .sort((a, b) => b.best - a.best)[0];

  const teamAverage = ratedMatches.length
    ? playerNames.reduce((sum, name) => sum + (playerTotals[name].count ? playerTotals[name].sum / playerTotals[name].count : 0), 0) / playerNames.length
    : 0;

  return [
    {
      label: "Partidas publicadas",
      value: String(ratedMatches.length),
      description: "Número de matérias com notas registradas no painel do FELAs FC."
    },
    {
      label: "Melhor média",
      value: `${formatPlayerName(bestAveragePlayer.name)} ${formatStatNumber(bestAveragePlayer.average)}`,
      description: "Jogador com a média mais alta considerando todas as notas publicadas."
    },
    {
      label: "Melhor nota única",
      value: `${formatPlayerName(bestSingleNote.name)} ${formatStatNumber(bestSingleNote.best)}`,
      description: "Maior nota individual registrada até agora nas publicações."
    },
    {
      label: "Média do time",
      value: formatStatNumber(teamAverage),
      description: "Média geral do quarteto principal nas partidas já cadastradas."
    },
    {
      label: "Ausências de Glik",
      value: String(playerTotals.Glik.absences),
      description: "Contagem automática de partidas em que Glik recebeu nota zero, tratada como ausência."
    },
    {
      label: "Ausências de Breno",
      value: String(playerTotals.Breno.absences),
      description: "Contagem automática de partidas em que Breno recebeu nota zero, tratada como ausência."
    },
    {
      label: "Ausências de Caio",
      value: String(playerTotals.Caio.absences),
      description: "Contagem automática de partidas em que Caio recebeu nota zero, tratada como ausência."
    },
    {
      label: "Ausências de João",
      value: String(playerTotals.Joao.absences),
      description: "Contagem automática de partidas em que João recebeu nota zero, tratada como ausência."
    },
    {
      label: "Boatos Obscuros sobre Glik",
      value: "2876",
      description: "Lendas e verdades sobre o controverso jogador."
    }
  ];
}

function createStatCardMarkup(stat) {
  return `
    <article class="stat-card">
      <span class="stat-label">${window.FelasNewsData.escapeHtml(stat.label)}</span>
      <strong>${window.FelasNewsData.escapeHtml(stat.value)}</strong>
      <p>${window.FelasNewsData.escapeHtml(stat.description)}</p>
    </article>
  `;
}

function renderPlayerHistory(newsItems) {
  if (!playerHistoryGrid) {
    return;
  }

  const playerNames = ["Breno", "Glik", "Joao", "Caio"];

  playerHistoryGrid.innerHTML = playerNames.map((playerName) => {
    const entries = newsItems
      .map((item) => {
        const rating = (item.ratings || []).find((entry) => entry.name === playerName);
        if (!rating) {
          return null;
        }

        const numericValue = Number(String(rating.value || "").replace(",", "."));
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          return null;
        }

        return {
          publishedDate: item.publishedDate,
          value: rating.value
        };
      })
      .filter(Boolean);

    return createPlayerHistoryMarkup(playerName, entries);
  }).join("");
}

function createPlayerHistoryMarkup(playerName, entries) {
  return `
    <article class="player-history-card">
      <div class="player-history-header">
        <div class="player-history-avatar">
          <img src="${window.FelasNewsData.escapeAttribute(getPlayerImage(playerName))}" alt="${window.FelasNewsData.escapeAttribute(formatPlayerName(playerName))}" style="object-position:${window.FelasNewsData.escapeAttribute(getPlayerImagePosition(playerName))}">
        </div>
        <div class="player-history-copy">
          <h3>${window.FelasNewsData.escapeHtml(formatPlayerName(playerName))}</h3>
          <p>${window.FelasNewsData.escapeHtml(entries.length ? `${entries.length} notas registradas` : "Sem notas registradas")}</p>
        </div>
      </div>
      <div class="player-history-list">
        ${entries.length
          ? entries.map((entry) => `
            <div class="player-history-item">
              <span class="player-history-date">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(entry.publishedDate))}</span>
              <strong class="player-history-value ${getHistoryValueClass(entry.value)}">${window.FelasNewsData.escapeHtml(entry.value)}</strong>
            </div>
          `).join("")
          : '<p class="empty-state">Esse jogador ainda nao tem notas cadastradas.</p>'}
      </div>
    </article>
  `;
}

function getPlayerImage(name) {
  return playerImages[name] || "breno.png";
}

function getPlayerImagePosition(name) {
  return playerImagePositions[name] || "center top";
}

function getHistoryValueClass(value) {
  const numeric = Number(String(value || "").replace(",", "."));

  if (numeric >= 7) {
    return "player-history-good";
  }

  if (numeric >= 4) {
    return "player-history-mid";
  }

  return "player-history-bad";
}

function formatStatNumber(value) {
  const numeric = Number(value || 0);
  return numeric.toFixed(1);
}

function formatPlayerName(name) {
  return name === "Joao" ? "João" : name;
}

function isCantinhoCategory(category) {
  return window.FelasNewsData.normalizeCategory(category) === "cantinho do louco";
}

function isPartidasCategory(category) {
  const normalized = window.FelasNewsData.normalizeCategory(category);
  return normalized === "partida" || normalized === "partidas";
}
