window.FelasSupabase = (() => {
  const TABLE_NAME = "news_articles";
  const MEDIA_TABLE_NAME = "media_videos";
  const config = window.FelasSupabaseConfig || {};
  const hasPublicConfig = Boolean(config.url && config.anonKey);
  const hasClientLibrary = Boolean(window.supabase?.createClient);
  const isConfigured = hasPublicConfig;
  const client = hasPublicConfig && hasClientLibrary
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  function getConfigError() {
    if (!config.url || !config.anonKey) {
      return "Supabase ainda nao configurado. Preencha o arquivo supabase-config.js.";
    }

    return "";
  }

  function ensurePublicConfigured() {
    if (!hasPublicConfig) {
      throw new Error(getConfigError() || "Supabase nao configurado.");
    }
  }

  function ensureAdminConfigured() {
    ensurePublicConfigured();

    if (!client) {
      throw new Error("Biblioteca do Supabase nao carregada.");
    }
  }

  function mapRowToNews(row) {
    return window.FelasNewsData.sanitizeNewsItem({
      id: row.id,
      category: row.category,
      title: row.title,
      summary: row.summary,
      content: row.content,
      publishedDate: row.published_date,
      createdAt: row.created_at,
      time: row.time_label,
      ratings: row.ratings
    });
  }

  function mapNewsToRow(item) {
    const sanitized = window.FelasNewsData.sanitizeNewsItem(item);
    return {
      id: sanitized.id || undefined,
      category: sanitized.category,
      title: sanitized.title,
      summary: sanitized.summary,
      content: sanitized.content,
      published_date: sanitized.publishedDate,
      time_label: sanitized.time,
      ratings: sanitized.ratings
    };
  }

  function mapRowToNewsSummary(row) {
    return window.FelasNewsData.sanitizeNewsItem({
      id: row.id,
      category: row.category,
      title: row.title,
      summary: row.summary,
      content: row.summary || "",
      publishedDate: row.published_date,
      createdAt: row.created_at,
      time: ""
    });
  }

  function mapRowToRatingsSummary(row) {
    return {
      publishedDate: row.published_date,
      ratings: Array.isArray(row.ratings)
        ? row.ratings
        : window.FelasNewsData.getDefaultRatings()
    };
  }

  function mapHomePayload(payload) {
    const feedItems = Array.isArray(payload?.feed)
      ? payload.feed.map(mapRowToNewsSummary)
      : [];

    return {
      feed: feedItems,
      latestRatings: payload?.latestRatings ? mapRowToRatingsSummary(payload.latestRatings) : null
    };
  }

  function prioritizeHomeFeed(items, limit) {
    const latestPartidas = items.find((item) => {
      const normalized = window.FelasNewsData.normalizeCategory(item.category);
      return normalized === "partida" || normalized === "partidas";
    });

    if (!latestPartidas) {
      return items.slice(0, limit);
    }

    return [
      latestPartidas,
      ...items.filter((item) => item.id !== latestPartidas.id)
    ].slice(0, limit);
  }

  async function restSelect(tableName, query = {}) {
    ensurePublicConfigured();

    const url = new URL(`${config.url}/rest/v1/${tableName}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar ${tableName}.`);
    }

    return response.json();
  }

  async function callRpc(functionName, payload = {}) {
    ensurePublicConfigured();

    const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Falha ao executar ${functionName}.`);
    }

    return response.json();
  }

  async function fetchPublishedNews(limit = null) {
    const data = await restSelect(TABLE_NAME, {
      select: "*",
      order: "published_date.desc,created_at.desc",
      limit: limit || undefined
    });

    return (data || []).map(mapRowToNews);
  }

  async function fetchNewsSummaries(options = {}) {
    const limit = options.limit || null;
    const category = String(options.category || "").trim();

    const data = await restSelect(TABLE_NAME, {
      select: "id,category,title,summary,published_date,created_at",
      order: "published_date.desc,created_at.desc",
      category: category ? `eq.${category}` : undefined,
      limit: limit || undefined
    });

    return (data || []).map(mapRowToNewsSummary);
  }

  async function fetchLatestRatedNewsSummary() {
    const data = await restSelect(TABLE_NAME, {
      select: "published_date,ratings",
      category: "neq.Cantinho do Louco",
      order: "published_date.desc,created_at.desc",
      limit: 1
    });

    return data && data[0] ? mapRowToRatingsSummary(data[0]) : null;
  }

  async function fetchHomePayload(options = {}) {
    const limit = Number(options.limit || 5);
    const category = String(options.category || "").trim();

    try {
      const payload = await callRpc("get_home_payload", {
        requested_category: category || null,
        requested_limit: limit
      });

      return mapHomePayload(payload);
    } catch (_error) {
      const summaryLimit = category ? limit : Math.max(limit + 6, 12);
      const [feedItems, latestRatings] = await Promise.all([
        fetchNewsSummaries({
          limit: summaryLimit,
          category: category || undefined
        }),
        fetchLatestRatedNewsSummary()
      ]);

      return {
        feed: category ? feedItems.slice(0, limit) : prioritizeHomeFeed(feedItems, limit),
        latestRatings
      };
    }
  }

  async function fetchNewsById(id) {
    const data = await restSelect(TABLE_NAME, {
      select: "*",
      id: `eq.${id}`,
      limit: 1
    });

    return data && data[0] ? mapRowToNews(data[0]) : null;
  }

  async function upsertNewsItem(item) {
    ensureAdminConfigured();

    const payload = mapNewsToRow(item);
    const { data, error } = await client
      .from(TABLE_NAME)
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return mapRowToNews(data);
  }

  async function deleteNewsItem(id) {
    ensureAdminConfigured();

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async function deleteAllNews() {
    ensureAdminConfigured();

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .not("id", "is", null);

    if (error) {
      throw error;
    }
  }

  async function replaceAllNews(items) {
    ensureAdminConfigured();
    await deleteAllNews();

    if (!Array.isArray(items) || !items.length) {
      return [];
    }

    const payload = items.map(mapNewsToRow);
    const { data, error } = await client
      .from(TABLE_NAME)
      .insert(payload)
      .select();

    if (error) {
      throw error;
    }

    return (data || []).map(mapRowToNews);
  }

  async function signIn(email, password) {
    ensureAdminConfigured();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    return data;
  }

  async function signOut() {
    ensureAdminConfigured();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async function getSession() {
    ensureAdminConfigured();
    const { data, error } = await client.auth.getSession();
    if (error) {
      throw error;
    }
    return data.session;
  }

  function onAuthStateChange(callback) {
    if (!client) {
      return { data: { subscription: { unsubscribe() {} } } };
    }

    return client.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }

  async function fetchMediaVideos(limit = null) {
    const data = await restSelect(MEDIA_TABLE_NAME, {
      select: "*",
      order: "published_date.desc,created_at.desc",
      limit: limit || undefined
    });

    return (data || []).map((item) => ({
      id: item.id,
      url: String(item.url || "").trim(),
      title: String(item.title || "").trim(),
      publishedDate: item.published_date,
      createdAt: item.created_at
    }));
  }

  async function upsertMediaVideo(item) {
    ensureAdminConfigured();

    const payload = {
      id: item.id || undefined,
      url: String(item.url || "").trim(),
      title: String(item.title || "").trim(),
      published_date: window.FelasNewsData.normalizeDate(item.publishedDate)
    };

    const { data, error } = await client
      .from(MEDIA_TABLE_NAME)
      .upsert(payload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      url: String(data.url || "").trim(),
      title: String(data.title || "").trim(),
      publishedDate: data.published_date,
      createdAt: data.created_at
    };
  }

  async function deleteMediaVideo(id) {
    ensureAdminConfigured();

    const { error } = await client
      .from(MEDIA_TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  return {
    tableName: TABLE_NAME,
    mediaTableName: MEDIA_TABLE_NAME,
    isConfigured,
    getConfigError,
    fetchPublishedNews,
    fetchHomePayload,
    fetchNewsSummaries,
    fetchLatestRatedNewsSummary,
    fetchNewsById,
    upsertNewsItem,
    deleteNewsItem,
    deleteAllNews,
    replaceAllNews,
    fetchMediaVideos,
    upsertMediaVideo,
    deleteMediaVideo,
    signIn,
    signOut,
    getSession,
    onAuthStateChange
  };
})();
