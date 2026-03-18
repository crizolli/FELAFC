const newsFeed = document.querySelector("#news-feed");
const ratingsDate = document.querySelector("#ratings-date");
const ratingsGrid = document.querySelector("#ratings-grid");
const refreshIndicator = document.querySelector("#refresh-indicator");
const newsCategoryFilter = document.body?.dataset.newsCategory || "";
const SESSION_CACHE_TTL = 60 * 1000;
const PERSISTENT_CACHE_TTL = 12 * 60 * 60 * 1000;
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
  const cachedPayload = readAnyCache(createHomePayloadCacheKey(), PERSISTENT_CACHE_TTL);
  if (cachedPayload) {
    renderHomePayload(cachedPayload);
  }
  renderNews({ keepExistingContent: Boolean(cachedPayload) });
}

async function renderNews(options = {}) {
  if (!window.FelasSupabase?.isConfigured) {
    renderNewsEmpty(window.FelasSupabase?.getConfigError() || "Supabase ainda nao configurado.");
    return;
  }

  if (!options.keepExistingContent) {
    newsFeed.innerHTML = '<p class="empty-state">Carregando noticias...</p>';

    if (ratingsDate) {
      ratingsDate.innerHTML = "";
    }

    if (ratingsGrid) {
      ratingsGrid.innerHTML = "";
    }
  }

  try {
    const payload = await getCachedHomePayload({
        limit: newsCategoryFilter ? 5 : 8,
        category: newsCategoryFilter || undefined
      }, options.forceRefresh);

    renderHomePayload(payload);
    if (options.showRefreshNotice) {
      showRefreshIndicator();
    }
  } catch (error) {
    if (!options.keepExistingContent) {
      renderNewsEmpty("Nao foi possivel carregar as noticias agora.");
    }
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

function renderHomePayload(payload) {
  const feedItems = Array.isArray(payload?.feed) ? payload.feed.slice(0, 5) : [];
  const latestRatings = payload?.latestRatings || null;

  if (!feedItems.length) {
    renderNewsEmpty("Nenhuma noticia publicada ainda.");
    return;
  }

  newsFeed.innerHTML = feedItems.map((item, index) => createFeedMarkup(item, index)).join("");

  if (ratingsDate) {
    ratingsDate.innerHTML = latestRatings ? createRatingsDateMarkup(latestRatings) : "";
  }

  if (ratingsGrid) {
    ratingsGrid.innerHTML = latestRatings ? createRatingsMarkup(latestRatings.ratings || window.FelasNewsData.getDefaultRatings()) : "";
  }

  renderMobileRatingsPanel(latestRatings);
}

function createFeedMarkup(item, index = 0) {
  const loadingMode = index === 0 ? "eager" : "lazy";
  const fetchPriority = index === 0 ? "high" : "low";

  return `
    <article class="feed-item">
      <div class="category-header">
        <img src="${window.FelasNewsData.escapeAttribute(window.FelasNewsData.createCategoryHeader(item.category))}" alt="Header visual da categoria ${window.FelasNewsData.escapeAttribute(item.category)}" loading="${loadingMode}" decoding="async" fetchpriority="${fetchPriority}" style="object-position:${window.FelasNewsData.escapeAttribute(window.FelasNewsData.getCategoryHeaderPosition(item.category))}">
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
          <img src="${window.FelasNewsData.escapeAttribute(getPlayerImage(rating.name))}" alt="${window.FelasNewsData.escapeAttribute(rating.name)}" loading="lazy" decoding="async" style="object-position:${window.FelasNewsData.escapeAttribute(getPlayerImagePosition(rating.name))}">
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

async function getCachedHomePayload(options, forceRefresh = false) {
  const cacheKey = createHomePayloadCacheKey(options);

  if (!forceRefresh) {
    const sessionCached = readSessionCache(cacheKey, SESSION_CACHE_TTL);
    if (sessionCached) {
      return sessionCached;
    }
  }

  const freshPayload = await window.FelasSupabase.fetchHomePayload(options);
  writeCache(cacheKey, freshPayload);
  return freshPayload;
}

function createHomePayloadCacheKey(options) {
  const category = String(options?.category || "all").trim().toLowerCase();
  return `felas:home-payload:${category}`;
}

function readAnyCache(key, ttl) {
  return readSessionCache(key, ttl) || readPersistentCache(key, ttl);
}

function writeCache(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      version: getNewsCacheVersion(),
      value
    }));
    window.localStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      version: getNewsCacheVersion(),
      value
    }));
  } catch (_error) {
    // Ignore cache write failures.
  }
}

function readSessionCache(key, ttl) {
  return readStoredCache(window.sessionStorage, key, ttl);
}

function readPersistentCache(key, ttl) {
  return readStoredCache(window.localStorage, key, ttl);
}

function readStoredCache(storage, key, ttl) {
  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed.savedAt !== "number") {
      storage.removeItem(key);
      return null;
    }

    if (parsed.version !== getNewsCacheVersion()) {
      storage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.savedAt > ttl) {
      storage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch (_error) {
    return null;
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

    renderNews({ showRefreshNotice: true, forceRefresh: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderNews({ showRefreshNotice: true, keepExistingContent: true, forceRefresh: true });
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
