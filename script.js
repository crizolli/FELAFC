const newsFeed = document.querySelector("#news-feed");
const ratingsDate = document.querySelector("#ratings-date");
const ratingsGrid = document.querySelector("#ratings-grid");
const newsCategoryFilter = document.body?.dataset.newsCategory || "";
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

if (newsFeed) {
  renderNews();
}

async function renderNews() {
  if (!window.FelasSupabase?.isConfigured) {
    renderNewsEmpty(window.FelasSupabase?.getConfigError() || "Supabase ainda nao configurado.");
    return;
  }

  newsFeed.innerHTML = '<p class="empty-state">Carregando noticias...</p>';

  if (ratingsDate) {
    ratingsDate.innerHTML = "";
  }

  if (ratingsGrid) {
    ratingsGrid.innerHTML = "";
  }

  try {
    const [newsItems, latestPartidasItem, latestRatedItem] = await Promise.all([
      window.FelasSupabase.fetchNewsSummaries({
        limit: newsCategoryFilter ? 5 : 8,
        category: newsCategoryFilter || undefined
      }),
      newsCategoryFilter ? Promise.resolve(null) : window.FelasSupabase.fetchNewsSummaries({ limit: 1, category: "Partidas" }).then((items) => items[0] || null),
      window.FelasSupabase.fetchLatestRatedNewsSummary()
    ]);

    const orderedNewsItems = newsCategoryFilter
      ? newsItems
      : prioritizeLatestPartidas(newsItems, latestPartidasItem);

    const visibleNewsItems = orderedNewsItems.slice(0, 5);
    const latestItem = visibleNewsItems[0];

    if (!visibleNewsItems.length) {
      renderNewsEmpty("Nenhuma noticia publicada ainda.");
      return;
    }

    const feedMarkup = createFeedWithMobileRatings(visibleNewsItems, latestRatedItem);
    newsFeed.innerHTML = feedMarkup;
    if (ratingsDate) {
      ratingsDate.innerHTML = latestRatedItem ? createRatingsDateMarkup(latestRatedItem) : "";
    }

    if (ratingsGrid) {
      ratingsGrid.innerHTML = latestRatedItem ? createRatingsMarkup(latestRatedItem.ratings || window.FelasNewsData.getDefaultRatings()) : "";
    }
  } catch (error) {
    renderNewsEmpty("Nao foi possivel carregar as noticias agora.");
  }
}

function renderNewsEmpty(message) {
  newsFeed.innerHTML = `<p class="empty-state">${window.FelasNewsData.escapeHtml(message)}</p>`;

  if (ratingsDate) {
    ratingsDate.innerHTML = "";
  }

  if (ratingsGrid) {
    ratingsGrid.innerHTML = "";
  }
}

function createFeedMarkup(item) {
  return `
    <article class="feed-item">
      <div class="category-header">
        <img src="${window.FelasNewsData.escapeAttribute(window.FelasNewsData.createCategoryHeader(item.category))}" alt="Header visual da categoria ${window.FelasNewsData.escapeAttribute(item.category)}" style="object-position:${window.FelasNewsData.escapeAttribute(window.FelasNewsData.getCategoryHeaderPosition(item.category))}">
      </div>
      <div class="article-copy">
        <span class="tag">${window.FelasNewsData.escapeHtml(item.category)}</span>
        <h2><a class="article-title-link" href="article.html?id=${window.FelasNewsData.escapeAttribute(item.id)}">${window.FelasNewsData.escapeHtml(item.title)}</a></h2>
        <p class="feed-date">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(item.publishedDate))}</p>
        <p>${window.FelasNewsData.escapeHtml(item.summary)}</p>
        <a class="read-more-link" href="article.html?id=${window.FelasNewsData.escapeAttribute(item.id)}">Ler noticia completa</a>
      </div>
    </article>
  `;
}

function createFeedWithMobileRatings(items, latestItem) {
  const isMobile = window.matchMedia("(max-width: 680px)").matches;

  if (!isMobile || !latestItem) {
    return items.map(createFeedMarkup).join("");
  }

  return items.map((item, index) => {
    const articleMarkup = createFeedMarkup(item);

    if (index === 0) {
      return `${articleMarkup}${createMobileRatingsMarkup(latestItem)}`;
    }

    return articleMarkup;
  }).join("");
}

function createRatingsDateMarkup(item) {
  return `
    <div class="ratings-date-card">
      <span class="ratings-date-label">Data da ultima nota</span>
      <strong class="ratings-date-value">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(item.publishedDate))}</strong>
    </div>
  `;
}

function createMobileRatingsMarkup(item) {
  return `
    <section class="mobile-ratings-panel">
      <div class="mobile-ratings-header">
        <p class="sidebar-kicker">Notas recentes</p>
      </div>
      ${createRatingsDateMarkup(item)}
      <div class="ratings-grid mobile-ratings-grid">
        ${createRatingsMarkup(item.ratings || window.FelasNewsData.getDefaultRatings())}
      </div>
    </section>
  `;
}

function createRatingsMarkup(ratings) {
  const topPlayerName = getTopPlayerName(ratings);

  return ratings.map((rating) => `
    <article class="rating-card ${getRatingClass(rating.value)} ${rating.name === topPlayerName ? "rating-top-player" : ""}">
      <div class="rating-player-row">
        <div class="rating-avatar">
          <img src="${window.FelasNewsData.escapeAttribute(getPlayerImage(rating.name))}" alt="${window.FelasNewsData.escapeAttribute(rating.name)}" style="object-position:${window.FelasNewsData.escapeAttribute(getPlayerImagePosition(rating.name))}">
        </div>
        <span class="rating-player">${window.FelasNewsData.escapeHtml(formatPlayerName(rating.name))}</span>
      </div>
      <strong class="rating-value">${window.FelasNewsData.escapeHtml(rating.value)}</strong>
    </article>
  `).join("");
}

function getPlayerImage(name) {
  return playerImages[name] || "breno.png";
}

function getPlayerImagePosition(name) {
  return playerImagePositions[name] || "center top";
}

function formatPlayerName(name) {
  return name === "Joao" ? "João" : name;
}

function getTopPlayerName(ratings) {
  let bestName = "";
  let bestValue = -1;

  ratings.forEach((rating) => {
    const numericValue = Number(String(rating.value || "").replace(",", "."));
    if (numericValue > bestValue) {
      bestValue = numericValue;
      bestName = rating.name;
    }
  });

  return bestName;
}

function getRatingClass(value) {
  const numeric = Number(String(value || "").replace(",", "."));

  if (numeric >= 7) {
    return "rating-good";
  }

  if (numeric >= 4) {
    return "rating-mid";
  }

  return "rating-bad";
}

function shouldShowRatings(category) {
  return !isCantinhoCategory(category);
}

function isCantinhoCategory(category) {
  return window.FelasNewsData.normalizeCategory(category) === "cantinho do louco";
}

function prioritizeLatestPartidas(items, latestPartidasItem) {
  const sortedItems = [...items];
  const firstPartidas = latestPartidasItem || sortedItems.find((item) => isPartidasCategory(item.category));

  if (!firstPartidas) {
    return sortedItems;
  }

  return [
    firstPartidas,
    ...sortedItems.filter((item) => item.id !== firstPartidas.id)
  ];
}

function isPartidasCategory(category) {
  const normalized = window.FelasNewsData.normalizeCategory(category);
  return normalized === "partida" || normalized === "partidas";
}
