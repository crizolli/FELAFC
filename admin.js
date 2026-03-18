const adminAuth = document.querySelector("#admin-auth");
const adminPanel = document.querySelector("#admin-panel");
const loginForm = document.querySelector("#login-form");
const loginFeedback = document.querySelector("#login-feedback");
const logoutAdminButton = document.querySelector("#logout-admin");
const newsForm = document.querySelector("#news-form");
const resetNewsButton = document.querySelector("#reset-news");
const formFeedback = document.querySelector("#form-feedback");
const submitNewsButton = document.querySelector("#submit-news");
const cancelEditButton = document.querySelector("#cancel-edit");
const publishedNewsList = document.querySelector("#published-news-list");
const exportNewsButton = document.querySelector("#export-news");
const importNewsInput = document.querySelector("#import-news");
const mediaForm = document.querySelector("#media-form");
const submitMediaButton = document.querySelector("#submit-media");
const cancelMediaEditButton = document.querySelector("#cancel-media-edit");
const mediaFeedback = document.querySelector("#media-feedback");
const mediaList = document.querySelector("#media-list");

let currentNews = [];
let currentMedia = [];

bootstrapAdmin();

async function bootstrapAdmin() {
  toggleEditMode(false);
  bindEvents();
  resetFormState();
  resetMediaFormState();

  if (!window.FelasSupabase?.isConfigured) {
    updateAdminVisibility(false);
    updateLoginFeedback(window.FelasSupabase?.getConfigError() || "Supabase ainda nao configurado.", true);
    return;
  }

  window.FelasSupabase.onAuthStateChange(async (session) => {
    await updateAuthenticatedState(Boolean(session));
  });

  try {
    const session = await window.FelasSupabase.getSession();
    await updateAuthenticatedState(Boolean(session));
  } catch (error) {
    updateAdminVisibility(false);
    updateLoginFeedback("Nao foi possivel validar a sessao do admin.", true);
  }
}

function bindEvents() {
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "").trim();

      try {
        await window.FelasSupabase.signIn(email, password);
        loginForm.reset();
        updateLoginFeedback("Login realizado com sucesso.", false);
      } catch (error) {
        updateLoginFeedback("Email ou senha invalidos.", true);
      }
    });
  }

  if (logoutAdminButton) {
    logoutAdminButton.addEventListener("click", async () => {
      try {
        await window.FelasSupabase.signOut();
        resetFormState();
        updateFormFeedback("Voce saiu do painel administrativo.", false);
      } catch (error) {
        updateFormFeedback("Nao foi possivel encerrar a sessao.", true);
      }
    });
  }

  if (newsForm) {
    newsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(newsForm);
      const editingId = String(formData.get("editingId") || "").trim();
      const category = String(formData.get("category") || "").trim();
      const title = String(formData.get("title") || "").trim();
      const content = String(formData.get("content") || "").trim();
      const publishedDate = window.FelasNewsData.normalizeDate(formData.get("publishedDate"));
      const ratings = [
        { name: "Breno", value: normalizeRating(formData.get("rating_breno")), note: normalizeRatingNote(formData.get("rating_note_breno")) },
        { name: "Glik", value: normalizeRating(formData.get("rating_glik")), note: normalizeRatingNote(formData.get("rating_note_glik")) },
        { name: "Joao", value: normalizeRating(formData.get("rating_joao")), note: normalizeRatingNote(formData.get("rating_note_joao")) },
        { name: "Caio", value: normalizeRating(formData.get("rating_caio")), note: normalizeRatingNote(formData.get("rating_note_caio")) }
      ];

      if (!title || !category || !content) {
        updateFormFeedback("Preencha categoria, titulo e conteudo completo.", true);
        return;
      }

      const existingItem = currentNews.find((item) => item.id === editingId);
      const summary = createSummaryFromContent(content);

      try {
        await window.FelasSupabase.upsertNewsItem({
          id: editingId || crypto.randomUUID(),
          category,
          title,
          summary,
          content,
          publishedDate,
          createdAt: existingItem?.createdAt || new Date().toISOString(),
          time: existingItem?.time || "Sem horario informado",
          ratings
        });

        await refreshPublishedNews();
        resetFormState();
        updateFormFeedback(editingId ? "Noticia atualizada com sucesso." : "Noticia publicada com sucesso.", false);
      } catch (error) {
        updateFormFeedback("Nao foi possivel salvar a noticia no Supabase.", true);
      }
    });
  }

  if (resetNewsButton) {
    resetNewsButton.addEventListener("click", async () => {
      try {
        await window.FelasSupabase.deleteAllNews();
        currentNews = [];
        renderPublishedNews(currentNews);
        resetFormState();
        updateFormFeedback("Todas as noticias publicadas foram removidas.", false);
      } catch (error) {
        updateFormFeedback("Nao foi possivel remover as noticias do banco.", true);
      }
    });
  }

  if (cancelEditButton) {
    cancelEditButton.addEventListener("click", () => {
      resetFormState();
      updateFormFeedback("Edicao cancelada.", false);
    });
  }

  if (publishedNewsList) {
    publishedNewsList.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionButton = target.closest("[data-action]");
      if (!actionButton) {
        return;
      }

      const { action, id } = actionButton.dataset;
      if (!id) {
        return;
      }

      if (action === "edit") {
        startEditingNews(id);
      }

      if (action === "delete") {
        await deleteNews(id);
      }
    });
  }

  if (exportNewsButton) {
    exportNewsButton.addEventListener("click", () => {
      if (!currentNews.length) {
        updateFormFeedback("Nao ha noticias para exportar.", true);
        return;
      }

      const blob = new Blob([JSON.stringify(currentNews, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "felasfc-noticias.json";
      link.click();
      URL.revokeObjectURL(link.href);
      updateFormFeedback("Arquivo JSON exportado com sucesso.", false);
    });
  }

  if (importNewsInput) {
    importNewsInput.addEventListener("change", async (event) => {
      const file = event.currentTarget.files && event.currentTarget.files[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const importedNews = JSON.parse(text);

        if (!Array.isArray(importedNews)) {
          throw new Error("Formato invalido");
        }

        const sanitizedNews = importedNews
          .filter(window.FelasNewsData.isValidNewsItem)
          .map((item) => window.FelasNewsData.sanitizeNewsItem({
            ...item,
            id: String(item.id || crypto.randomUUID()),
            createdAt: item.createdAt || new Date().toISOString()
          }));

        await window.FelasSupabase.replaceAllNews(sanitizedNews);
        await refreshPublishedNews();
        resetFormState();
        updateFormFeedback("Noticias importadas com sucesso.", false);
      } catch (error) {
        updateFormFeedback("Nao foi possivel importar esse arquivo JSON.", true);
      } finally {
        event.currentTarget.value = "";
      }
    });
  }

  if (mediaForm) {
    mediaForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(mediaForm);
      const editingMediaId = String(formData.get("editingMediaId") || "").trim();
      const mediaUrl = String(formData.get("mediaUrl") || "").trim();
      const mediaTitle = String(formData.get("mediaTitle") || "").trim();
      const mediaPublishedDate = window.FelasNewsData.normalizeDate(formData.get("mediaPublishedDate"));

      if (!mediaUrl) {
        updateMediaFeedback("Informe uma URL do YouTube.", true);
        return;
      }

      try {
        await window.FelasSupabase.upsertMediaVideo({
          id: editingMediaId || crypto.randomUUID(),
          url: mediaUrl,
          title: mediaTitle,
          publishedDate: mediaPublishedDate
        });

        await refreshMedia();
        resetMediaFormState();
        updateMediaFeedback(editingMediaId ? "Vídeo atualizado com sucesso." : "Vídeo cadastrado com sucesso.", false);
      } catch (error) {
        updateMediaFeedback("Nao foi possivel salvar esse vídeo no Supabase.", true);
      }
    });
  }

  if (cancelMediaEditButton) {
    cancelMediaEditButton.addEventListener("click", () => {
      resetMediaFormState();
      updateMediaFeedback("Edicao de vídeo cancelada.", false);
    });
  }

  if (mediaList) {
    mediaList.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const actionButton = target.closest("[data-media-action]");
      if (!actionButton) {
        return;
      }

      const { mediaAction, id } = actionButton.dataset;
      if (!id) {
        return;
      }

      if (mediaAction === "edit") {
        startEditingMedia(id);
      }

      if (mediaAction === "delete") {
        await deleteMedia(id);
      }
    });
  }
}

async function updateAuthenticatedState(isAuthenticated) {
  updateAdminVisibility(isAuthenticated);

  if (!isAuthenticated) {
    currentNews = [];
    currentMedia = [];
    renderPublishedNews(currentNews);
    renderMediaList(currentMedia);
    return;
  }

  await refreshPublishedNews();
  await refreshMedia();
}

function updateAdminVisibility(isAuthenticated) {
  if (adminAuth) {
    adminAuth.classList.toggle("hidden", isAuthenticated);
  }
  if (adminPanel) {
    adminPanel.classList.toggle("hidden", !isAuthenticated);
  }
}

async function refreshPublishedNews() {
  currentNews = await window.FelasSupabase.fetchPublishedNews();
  renderPublishedNews(currentNews);
}

async function refreshMedia() {
  currentMedia = await window.FelasSupabase.fetchMediaVideos();
  renderMediaList(currentMedia);
}

function renderPublishedNews(items) {
  if (!publishedNewsList) {
    return;
  }

  if (!items.length) {
    publishedNewsList.innerHTML = '<p class="empty-state">Voce ainda nao publicou noticias no Supabase.</p>';
    return;
  }

  const sortedItems = window.FelasNewsData.sortNewsByDate(items);

  publishedNewsList.innerHTML = sortedItems.map((item) => `
    <article class="published-item">
      <div class="published-item-copy">
        <span class="tag">${window.FelasNewsData.escapeHtml(item.category)}</span>
        <h3>${window.FelasNewsData.escapeHtml(item.title)}</h3>
        <p>${window.FelasNewsData.escapeHtml(item.summary)}</p>
        <span class="published-item-date">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(item.publishedDate))}</span>
      </div>
      <div class="published-item-actions">
        <a class="button-secondary small-button" href="article.html?id=${window.FelasNewsData.escapeAttribute(item.id)}">Abrir</a>
        <button type="button" class="button-secondary small-button" data-action="edit" data-id="${window.FelasNewsData.escapeAttribute(item.id)}">Editar</button>
        <button type="button" class="button-secondary small-button danger-button" data-action="delete" data-id="${window.FelasNewsData.escapeAttribute(item.id)}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function renderMediaList(items) {
  if (!mediaList) {
    return;
  }

  if (!items.length) {
    mediaList.innerHTML = '<p class="empty-state">Voce ainda nao cadastrou videos.</p>';
    return;
  }

  mediaList.innerHTML = items.map((item) => `
    <article class="published-item">
      <div class="published-item-copy">
        <span class="tag">Mídia</span>
        <h3>${window.FelasNewsData.escapeHtml(item.title || "Video sem título")}</h3>
        <p>${window.FelasNewsData.escapeHtml(item.url)}</p>
        <span class="published-item-date">${window.FelasNewsData.escapeHtml(window.FelasNewsData.formatDate(item.publishedDate))}</span>
      </div>
      <div class="published-item-actions">
        <a class="button-secondary small-button" href="${window.FelasNewsData.escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer">Abrir URL</a>
        <button type="button" class="button-secondary small-button" data-media-action="edit" data-id="${window.FelasNewsData.escapeAttribute(item.id)}">Editar</button>
        <button type="button" class="button-secondary small-button danger-button" data-media-action="delete" data-id="${window.FelasNewsData.escapeAttribute(item.id)}">Excluir</button>
      </div>
    </article>
  `).join("");
}

function startEditingNews(id) {
  const item = currentNews.find((entry) => entry.id === id);
  if (!item || !newsForm) {
    return;
  }

  newsForm.elements.namedItem("editingId").value = item.id;
  newsForm.elements.namedItem("category").value = item.category || "";
  newsForm.elements.namedItem("title").value = item.title || "";
  newsForm.elements.namedItem("content").value = item.content || "";
  newsForm.elements.namedItem("publishedDate").value = window.FelasNewsData.normalizeDate(item.publishedDate);
  fillRatingsForm(item.ratings || window.FelasNewsData.getDefaultRatings());
  toggleEditMode(true);
  updateFormFeedback(`Editando noticia: ${item.title}`, false);
  newsForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteNews(id) {
  try {
    await window.FelasSupabase.deleteNewsItem(id);
    currentNews = currentNews.filter((item) => item.id !== id);
    renderPublishedNews(currentNews);

    if (newsForm && newsForm.elements.namedItem("editingId").value === id) {
      resetFormState();
    }

    updateFormFeedback("Noticia removida com sucesso.", false);
  } catch (error) {
    updateFormFeedback("Nao foi possivel remover a noticia.", true);
  }
}

function resetFormState() {
  if (!newsForm) {
    return;
  }

  newsForm.reset();
  newsForm.elements.namedItem("editingId").value = "";
  newsForm.elements.namedItem("publishedDate").value = window.FelasNewsData.normalizeDate(new Date().toISOString().slice(0, 10));
  fillRatingsForm(window.FelasNewsData.getDefaultRatings());
  toggleEditMode(false);
}

function resetMediaFormState() {
  if (!mediaForm) {
    return;
  }

  mediaForm.reset();
  mediaForm.elements.namedItem("editingMediaId").value = "";
  mediaForm.elements.namedItem("mediaPublishedDate").value = window.FelasNewsData.normalizeDate(new Date().toISOString().slice(0, 10));
  toggleMediaEditMode(false);
}

function toggleEditMode(isEditing) {
  if (submitNewsButton) {
    submitNewsButton.textContent = isEditing ? "Salvar alteracoes" : "Publicar noticia";
  }
  if (cancelEditButton) {
    cancelEditButton.hidden = !isEditing;
  }
}

function toggleMediaEditMode(isEditing) {
  if (submitMediaButton) {
    submitMediaButton.textContent = isEditing ? "Salvar alteracoes" : "Salvar video";
  }
  if (cancelMediaEditButton) {
    cancelMediaEditButton.hidden = !isEditing;
  }
}

function updateLoginFeedback(message, isError) {
  if (!loginFeedback) {
    return;
  }
  loginFeedback.textContent = message;
  loginFeedback.classList.toggle("is-error", Boolean(isError));
}

function updateFormFeedback(message, isError) {
  if (!formFeedback) {
    return;
  }
  formFeedback.textContent = message;
  formFeedback.classList.toggle("is-error", Boolean(isError));
}

function updateMediaFeedback(message, isError) {
  if (!mediaFeedback) {
    return;
  }
  mediaFeedback.textContent = message;
  mediaFeedback.classList.toggle("is-error", Boolean(isError));
}

function normalizeRating(value) {
  const numeric = Number(String(value || "").replace(",", "."));
  if (Number.isNaN(numeric)) {
    return "0.0";
  }
  return numeric.toFixed(1);
}

function normalizeRatingNote(value) {
  return String(value || "").trim();
}

function createSummaryFromContent(content) {
  const normalized = String(content || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > 280 ? `${normalized.slice(0, 277).trimEnd()}...` : normalized;
}

function fillRatingsForm(ratings) {
  if (!newsForm || !Array.isArray(ratings)) {
    return;
  }

  const mapping = {
    Breno: { value: "rating_breno", note: "rating_note_breno" },
    Glik: { value: "rating_glik", note: "rating_note_glik" },
    Joao: { value: "rating_joao", note: "rating_note_joao" },
    Caio: { value: "rating_caio", note: "rating_note_caio" }
  };

  ratings.forEach((rating) => {
    const fields = mapping[rating.name];
    if (!fields) {
      return;
    }
    const valueInput = newsForm.elements.namedItem(fields.value);
    const noteInput = newsForm.elements.namedItem(fields.note);
    if (valueInput) {
      valueInput.value = rating.value || "";
    }
    if (noteInput) {
      noteInput.value = rating.note || "";
    }
  });
}

function startEditingMedia(id) {
  const item = currentMedia.find((entry) => entry.id === id);
  if (!item || !mediaForm) {
    return;
  }

  mediaForm.elements.namedItem("editingMediaId").value = item.id;
  mediaForm.elements.namedItem("mediaUrl").value = item.url || "";
  mediaForm.elements.namedItem("mediaTitle").value = item.title || "";
  mediaForm.elements.namedItem("mediaPublishedDate").value = window.FelasNewsData.normalizeDate(item.publishedDate);
  toggleMediaEditMode(true);
  updateMediaFeedback(`Editando vídeo: ${item.title || item.url}`, false);
  mediaForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteMedia(id) {
  try {
    await window.FelasSupabase.deleteMediaVideo(id);
    currentMedia = currentMedia.filter((item) => item.id !== id);
    renderMediaList(currentMedia);

    if (mediaForm && mediaForm.elements.namedItem("editingMediaId").value === id) {
      resetMediaFormState();
    }

    updateMediaFeedback("Vídeo removido com sucesso.", false);
  } catch (error) {
    updateMediaFeedback("Nao foi possivel remover o vídeo.", true);
  }
}
