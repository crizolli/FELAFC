const mediaGrid = document.querySelector("#media-grid");

if (mediaGrid) {
  renderMediaGrid();
}

async function renderMediaGrid() {
  if (!window.FelasSupabase?.isConfigured) {
    renderMediaEmpty("Supabase nao configurado.", "Preencha o arquivo supabase-config.js para carregar a página de mídia.");
    return;
  }

  try {
    const mediaItems = await window.FelasSupabase.fetchMediaVideos(9);
    const validItems = mediaItems
      .map((item, index) => ({
        url: item.url,
        embedUrl: toYouTubeEmbedUrl(item.url),
        title: item.title || `Video ${index + 1}`,
        publishedDate: item.publishedDate
      }))
      .filter((item) => item.embedUrl);

    if (!validItems.length) {
      renderMediaEmpty("Nenhum vídeo cadastrado", "Cadastre URLs do YouTube no painel Admin para preencher esta página.");
      return;
    }

    mediaGrid.innerHTML = validItems.map((item) => `
      <article class="media-card">
        <div class="media-card-copy">
          <span class="media-date">${escapeAttribute(formatDate(item.publishedDate))}</span>
        </div>
        <iframe src="${escapeAttribute(item.embedUrl)}" title="${escapeAttribute(item.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </article>
    `).join("");
  } catch (error) {
    renderMediaEmpty("Erro ao carregar", "Nao foi possivel buscar os vídeos no Supabase agora.");
  }
}

function renderMediaEmpty(title, description) {
  mediaGrid.innerHTML = `
    <article class="media-empty">
      <p class="eyebrow">Mídia</p>
      <h2>${escapeAttribute(title)}</h2>
      <p>${escapeAttribute(description)}</p>
    </article>
  `;
}

function toYouTubeEmbedUrl(url) {
  const raw = String(url || "").trim();

  if (!raw) {
    return "";
  }

  if (raw.includes("youtube.com/embed/")) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "").trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const videoId = parsed.searchParams.get("v");
        return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        const videoId = parsed.pathname.split("/")[2];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
      }
    }
  } catch (error) {
    return "";
  }

  return "";
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(value) {
  return window.FelasNewsData.formatDate(value);
}
