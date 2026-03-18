const articlePage = document.querySelector("#article-page");
const params = new URLSearchParams(window.location.search);
const articleId = params.get("id");
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

if (articlePage) {
  renderArticle();
}

async function renderArticle() {
  if (!window.FelasSupabase?.isConfigured) {
    renderArticleEmpty("Supabase ainda nao configurado.");
    return;
  }

  if (!articleId) {
    renderArticleEmpty("Noticia nao encontrada");
    return;
  }

  articlePage.innerHTML = `
    <div class="article-empty">
      <p class="eyebrow">FIFA NEWS</p>
      <h2>Carregando materia</h2>
      <p>Buscando o conteudo completo da noticia.</p>
    </div>
  `;

  try {
    const item = await window.FelasSupabase.fetchNewsById(articleId);
    if (!item) {
      renderArticleEmpty("Noticia nao encontrada");
      return;
    }

    articlePage.innerHTML = `
      <div class="category-header article-category-header">
        <img src="${window.FelasNewsData.escapeAttribute(window.FelasNewsData.createCategoryHeader(item.category))}" alt="Header visual da categoria ${window.FelasNewsData.escapeAttribute(item.category)}" style="object-position:${window.FelasNewsData.escapeAttribute(window.FelasNewsData.getCategoryHeaderPosition(item.category))}">
      </div>
      <div class="article-page-body">
        <span class="tag">${window.FelasNewsData.escapeHtml(item.category)}</span>
        <h2>${window.FelasNewsData.escapeHtml(item.title)}</h2>
        <p class="article-date">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(item.publishedDate))}</p>
        ${createParagraphs(item.content || item.summary)}
        ${shouldShowRatings(item.category) ? createRatingsSection(item.ratings || window.FelasNewsData.getDefaultRatings()) : ""}
        <a class="button-primary article-back" href="index.html">Voltar para a home</a>
      </div>
    `;
  } catch (error) {
    renderArticleEmpty("Nao foi possivel carregar essa noticia.");
  }
}

function renderArticleEmpty(title) {
  articlePage.innerHTML = `
    <div class="article-empty">
      <p class="eyebrow">FIFA NEWS</p>
      <h2>${window.FelasNewsData.escapeHtml(title)}</h2>
      <p>Essa materia nao existe, foi removida ou o banco ainda nao esta configurado.</p>
      <a class="button-primary article-back" href="index.html">Voltar para a home</a>
    </div>
  `;
}

function createParagraphs(text) {
  return String(text)
    .split(/\n+/)
    .filter(Boolean)
    .map((paragraph) => `<p>${window.FelasNewsData.escapeHtml(paragraph)}</p>`)
    .join("");
}

function createRatingsSection(ratings) {
  const topPlayerName = getTopPlayerName(ratings);

  return `
    <section class="article-ratings">
      <div class="article-ratings-header">
        <p class="eyebrow">Notas do jogo</p>
        <h3>Desempenho dos jogadores</h3>
      </div>
      <div class="article-ratings-grid">
        ${ratings.map((rating) => `
          <article class="rating-card ${getRatingClass(rating.value)} ${rating.name === topPlayerName ? "rating-top-player" : ""}">
            <div class="rating-player-row">
              <div class="rating-avatar">
                <img src="${window.FelasNewsData.escapeAttribute(getPlayerImage(rating.name))}" alt="${window.FelasNewsData.escapeAttribute(rating.name)}" style="object-position:${window.FelasNewsData.escapeAttribute(getPlayerImagePosition(rating.name))}">
              </div>
              <span class="rating-player">${window.FelasNewsData.escapeHtml(formatPlayerName(rating.name))}</span>
            </div>
            <strong class="rating-value">${window.FelasNewsData.escapeHtml(rating.value)}</strong>
            ${rating.note ? `<p class="rating-note">${window.FelasNewsData.escapeHtml(rating.note)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `;
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

function getPlayerImage(name) {
  return playerImages[name] || "breno.png";
}

function getPlayerImagePosition(name) {
  return playerImagePositions[name] || "center top";
}

function formatPlayerName(name) {
  return name === "Joao" ? "João" : name;
}

function shouldShowRatings(category) {
  return window.FelasNewsData.normalizeCategory(category) !== "cantinho do louco";
}
