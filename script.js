const newsFeed = document.querySelector("#news-feed");
const ratingsDate = document.querySelector("#ratings-date");
const ratingsGrid = document.querySelector("#ratings-grid");
const refreshIndicator = document.querySelector("#refresh-indicator");
const newsCategoryFilter = document.body?.dataset.newsCategory || "";
const FEED_CACHE_TTL = 60 * 1000;
const RATINGS_CACHE_TTL = 60 * 1000;
const NEWS_CACHE_VERSION_KEY = "felas:news-cache-version";
let refreshIndicatorTimer = 0;
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
  bindLiveRefresh();
  renderNews();
}

async function renderNews(options = {}) {
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
    const [newsItems, latestPartidasItem] = await Promise.all([
      getCachedFeedItems({
        limit: newsCategoryFilter ? 5 : 8,
        category: newsCategoryFilter || undefined
      }),
      newsCategoryFilter ? Promise.resolve(null) : getCachedLatestPartidas()
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

    newsFeed.innerHTML = visibleNewsItems.map(createFeedMarkup).join("");
    renderLatestRatings();
    if (options.showRefreshNotice) {
      showRefreshIndicator();
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
    <section class="mobile-ratings-panel" data-mobile-ratings-panel>
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

async function renderLatestRatings() {
  try {
    const latestRatedItem = await getCachedLatestRatings();

    if (ratingsDate) {
      ratingsDate.innerHTML = latestRatedItem ? createRatingsDateMarkup(latestRatedItem) : "";
    }

    if (ratingsGrid) {
      ratingsGrid.innerHTML = latestRatedItem ? createRatingsMarkup(latestRatedItem.ratings || window.FelasNewsData.getDefaultRatings()) : "";
    }

    renderMobileRatingsPanel(latestRatedItem);
  } catch (_error) {
    if (ratingsDate) {
      ratingsDate.innerHTML = "";
    }

    if (ratingsGrid) {
      ratingsGrid.innerHTML = "";
    }

    renderMobileRatingsPanel(null);
  }
}

function renderMobileRatingsPanel(item) {
  const existingPanel = newsFeed.querySelector("[data-mobile-ratings-panel]");
  if (existingPanel) {
    existingPanel.remove();
  }

  const isMobile = window.matchMedia("(max-width: 680px)").matches;
  if (!isMobile || !item) {
    return;
  }

  const firstFeedItem = newsFeed.querySelector(".feed-item");
  if (!firstFeedItem) {
    return;
  }

  firstFeedItem.insertAdjacentHTML("afterend", createMobileRatingsMarkup(item));
}

async function getCachedFeedItems(options) {
  const cacheKey = createFeedCacheKey(options);
  const cachedValue = readCache(cacheKey, FEED_CACHE_TTL);

  if (cachedValue) {
    return cachedValue;
  }

  const freshItems = await window.FelasSupabase.fetchNewsSummaries(options);
  writeCache(cacheKey, freshItems);
  return freshItems;
}

async function getCachedLatestPartidas() {
  const cacheKey = createFeedCacheKey({ limit: 1, category: "Partidas" });
  const cachedValue = readCache(cacheKey, FEED_CACHE_TTL);

  if (cachedValue) {
    return cachedValue[0] || null;
  }

  const items = await window.FelasSupabase.fetchNewsSummaries({ limit: 1, category: "Partidas" });
  writeCache(cacheKey, items);
  return items[0] || null;
}

async function getCachedLatestRatings() {
  const cacheKey = "felas:latest-ratings";
  const cachedValue = readCache(cacheKey, RATINGS_CACHE_TTL);

  if (cachedValue) {
    return cachedValue;
  }

  const freshItem = await window.FelasSupabase.fetchLatestRatedNewsSummary();
  writeCache(cacheKey, freshItem);
  return freshItem;
}

function createFeedCacheKey(options) {
  const limit = Number(options?.limit || 0);
  const category = String(options?.category || "all").trim().toLowerCase();
  return `felas:feed:${category}:${limit}`;
}

function readCache(key, ttl) {
  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed.savedAt !== "number") {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (parsed.version !== getNewsCacheVersion()) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.savedAt > ttl) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch (_error) {
    return null;
  }
}

function writeCache(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      version: getNewsCacheVersion(),
      value
    }));
  } catch (_error) {
    // Ignore cache write failures.
  }
}

function getNewsCacheVersion() {
  try {
    return window.localStorage.getItem(NEWS_CACHE_VERSION_KEY) || "0";
  } catch (_error) {
    return "0";
  }
}

function bindLiveRefresh() {
  window.addEventListener("storage", (event) => {
    if (event.key !== NEWS_CACHE_VERSION_KEY) {
      return;
    }

    renderNews({ showRefreshNotice: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderNews({ showRefreshNotice: true });
    }
  });
}

function showRefreshIndicator() {
  if (!refreshIndicator) {
    return;
  }

  window.clearTimeout(refreshIndicatorTimer);
  refreshIndicator.hidden = false;
  requestAnimationFrame(() => {
    refreshIndicator.classList.add("is-visible");
  });

  refreshIndicatorTimer = window.setTimeout(() => {
    refreshIndicator.classList.remove("is-visible");
    window.setTimeout(() => {
      refreshIndicator.hidden = true;
    }, 180);
  }, 2200);
}
