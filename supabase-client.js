window.FelasSupabase = (() => {
  const TABLE_NAME = "news_articles";
  const MEDIA_TABLE_NAME = "media_videos";
  const config = window.FelasSupabaseConfig || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase?.createClient);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;

  function getConfigError() {
    if (!window.supabase?.createClient) {
      return "Biblioteca do Supabase nao carregada.";
    }

    if (!config.url || !config.anonKey) {
      return "Supabase ainda nao configurado. Preencha o arquivo supabase-config.js.";
    }

    return "";
  }

  function ensureConfigured() {
    if (!client) {
      throw new Error(getConfigError() || "Supabase nao configurado.");
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

  async function fetchPublishedNews(limit = null) {
    ensureConfigured();

    let query = client
      .from(TABLE_NAME)
      .select("*")
      .order("published_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data || []).map(mapRowToNews);
  }

  async function fetchNewsById(id) {
    ensureConfigured();

    const { data, error } = await client
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapRowToNews(data) : null;
  }

  async function upsertNewsItem(item) {
    ensureConfigured();

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
    ensureConfigured();

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }

  async function deleteAllNews() {
    ensureConfigured();

    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .not("id", "is", null);

    if (error) {
      throw error;
    }
  }

  async function replaceAllNews(items) {
    ensureConfigured();
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
    ensureConfigured();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    return data;
  }

  async function signOut() {
    ensureConfigured();
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async function getSession() {
    ensureConfigured();
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
    ensureConfigured();

    let query = client
      .from(MEDIA_TABLE_NAME)
      .select("*")
      .order("published_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return (data || []).map((item) => ({
      id: item.id,
      url: String(item.url || "").trim(),
      title: String(item.title || "").trim(),
      publishedDate: item.published_date,
      createdAt: item.created_at
    }));
  }

  async function upsertMediaVideo(item) {
    ensureConfigured();

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
    ensureConfigured();

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
