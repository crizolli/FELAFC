window.FelasNewsData = (() => {
  function encodeSvgText(value) {
    return String(value).replace(/[&<>'"]/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function normalizeCategory(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizeDate(value) {
    const raw = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    const normalized = normalizeDate(value);
    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  }

  function normalizeCreatedAt(value, id = "") {
    const timestamp = Date.parse(String(value || ""));
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }

    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const idMatch = String(id).match(/(\d{10,})/);
    if (idMatch) {
      return Number(idMatch[1]);
    }

    return 0;
  }

  function sortNewsByDate(items) {
    return [...items].sort((a, b) => {
      const dateA = normalizeDate(a.publishedDate);
      const dateB = normalizeDate(b.publishedDate);

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      const createdAtA = normalizeCreatedAt(a.createdAt, a.id);
      const createdAtB = normalizeCreatedAt(b.createdAt, b.id);

      if (createdAtA !== createdAtB) {
        return createdAtB - createdAtA;
      }

      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }

  function getDefaultRatings(values = {}) {
    return [
      { name: "Breno", value: values.Breno || "0.0", note: values.BrenoNote || "" },
      { name: "Glik", value: values.Glik || "0.0", note: values.GlikNote || "" },
      { name: "Joao", value: values.Joao || "0.0", note: values.JoaoNote || "" },
      { name: "Caio", value: values.Caio || "0.0", note: values.CaioNote || "" }
    ];
  }

  function sanitizeRatings(ratings) {
    const allowedOrder = ["Breno", "Glik", "Joao", "Caio"];
    const safeRatings = Array.isArray(ratings) ? ratings : [];

    return allowedOrder.map((name) => {
      const existing = safeRatings.find((rating) => rating && rating.name === name);
      const fallback = getDefaultRatings().find((rating) => rating.name === name);

      return {
        name,
        value: existing?.value || fallback?.value || "0.0",
        note: String(existing?.note || fallback?.note || "")
      };
    });
  }

  function isValidNewsItem(item) {
    return Boolean(
      item &&
      typeof item.title === "string" &&
      typeof item.summary === "string" &&
      typeof item.content === "string"
    );
  }

  function sanitizeNewsItem(item) {
    return {
      id: String(item.id || ""),
      category: String(item.category || "FIFA NEWS"),
      title: String(item.title || ""),
      summary: String(item.summary || ""),
      content: String(item.content || item.summary || ""),
      publishedDate: normalizeDate(item.publishedDate),
      createdAt: item.createdAt || new Date().toISOString(),
      time: String(item.time || "Sem horario informado"),
      ratings: sanitizeRatings(item.ratings)
    };
  }

  function createCategoryHeader(category) {
    const normalized = normalizeCategory(category);

    if (normalized === "partida" || normalized === "partidas") {
      return "estadios-em-sao-paulo.webp";
    }

    if (normalized === "cantinho do louco") {
      return "cantinholouco.jpg";
    }

    const config = getCategoryBannerConfig(normalized);
    const safeTitle = encodeSvgText(config.title);
    const safeSubtitle = encodeSvgText(config.subtitle);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1400 280'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop stop-color='${config.start}'/><stop offset='1' stop-color='${config.end}'/></linearGradient></defs><rect width='1400' height='280' fill='url(%23g)'/>${config.art}<text x='80' y='122' fill='white' font-family='Arial' font-size='46' font-weight='700'>${safeTitle}</text><text x='80' y='178' fill='rgba(255,255,255,0.82)' font-family='Arial' font-size='26'>${safeSubtitle}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function getCategoryHeaderPosition(category) {
    const normalized = normalizeCategory(category);

    if (normalized === "partida" || normalized === "partidas") {
      return "center 72%";
    }

    if (normalized === "cantinho do louco") {
      return "center center";
    }

    return "center center";
  }

  function getCategoryBannerConfig(category) {
    if (category === "partida" || category === "partidas") {
      return {
        title: "Partidas",
        subtitle: "Campo, placar e analise do jogo",
        start: "#0b1d13",
        end: "#1f8f5f",
        art: "<rect x='42' y='34' width='1316' height='212' rx='24' fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='4'/><circle cx='700' cy='140' r='48' fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='4'/><path d='M700 34v212M42 140h1316' stroke='rgba(255,255,255,0.14)' stroke-width='4'/>"
      };
    }

    if (category === "cantinho do louco") {
      return {
        title: "Cantinho do Louco",
        subtitle: "Cronicas, ideias e reflexoes do caos",
        start: "#1f2937",
        end: "#7c3aed",
        art: "<circle cx='1080' cy='138' r='52' fill='rgba(255,255,255,0.1)'/><path d='M1032 158c24-38 78-36 96 0' stroke='white' stroke-width='6' fill='none'/><circle cx='1060' cy='118' r='7' fill='white'/><circle cx='1104' cy='118' r='7' fill='white'/><path d='M914 86h88M914 126h126M914 166h110' stroke='rgba(255,255,255,0.36)' stroke-width='10' stroke-linecap='round'/>"
      };
    }

    if (category === "melhores momentos") {
      return {
        title: "Melhores Momentos",
        subtitle: "Lances, recortes e destaques da rodada",
        start: "#172554",
        end: "#ea580c",
        art: "<rect x='892' y='66' width='264' height='148' rx='24' fill='rgba(255,255,255,0.12)'/><polygon points='1002,108 1002,172 1062,140' fill='white'/><circle cx='1144' cy='104' r='16' fill='rgba(255,255,255,0.72)'/><circle cx='1144' cy='176' r='10' fill='rgba(255,255,255,0.38)'/>"
      };
    }

    if (category === "lesoes" || category === "lesao" || category === "lesões" || category === "lesão") {
      return {
        title: "Lesoes",
        subtitle: "Boletim medico e atualizacao do elenco",
        start: "#243b55",
        end: "#c0392b",
        art: "<rect x='980' y='56' width='200' height='140' rx='18' fill='rgba(255,255,255,0.12)'/><rect x='1066' y='82' width='28' height='88' fill='white'/><rect x='1036' y='112' width='88' height='28' fill='white'/><rect x='860' y='74' width='90' height='110' rx='16' fill='rgba(255,255,255,0.1)'/><rect x='874' y='94' width='62' height='12' rx='6' fill='rgba(255,255,255,0.7)'/><rect x='874' y='120' width='52' height='12' rx='6' fill='rgba(255,255,255,0.55)'/>"
      };
    }

    if (category === "tatica") {
      return {
        title: "Tatica",
        subtitle: "Setas, organizacao e plano de jogo",
        start: "#1f2937",
        end: "#2563eb",
        art: "<rect x='910' y='52' width='300' height='170' rx='18' fill='rgba(255,255,255,0.12)'/><circle cx='980' cy='110' r='10' fill='white'/><circle cx='1125' cy='94' r='10' fill='white'/><circle cx='1040' cy='170' r='10' fill='white'/><path d='M988 112c44 8 80 2 128-12' stroke='white' stroke-width='4' fill='none'/><path d='M1112 100l18-6-8 18' fill='white'/><path d='M1045 160c18-20 44-34 74-44' stroke='rgba(255,255,255,0.75)' stroke-width='4' fill='none' stroke-dasharray='8 8'/>"
      };
    }

    if (category === "bastidores") {
      return {
        title: "Bastidores",
        subtitle: "Vestiario, clima e historias do clube",
        start: "#2d1b4e",
        end: "#d97706",
        art: "<circle cx='1080' cy='142' r='54' fill='rgba(255,255,255,0.12)'/><rect x='890' y='88' width='120' height='108' rx='18' fill='rgba(255,255,255,0.12)'/><circle cx='950' cy='142' r='28' fill='none' stroke='white' stroke-width='6'/><rect x='1008' y='116' width='62' height='52' rx='14' fill='rgba(255,255,255,0.22)'/>"
      };
    }

    return {
      title: "FIFA NEWS",
      subtitle: "Atualizacao oficial do FELAs FC",
      start: "#0f172a",
      end: "#14532d",
      art: "<rect x='930' y='60' width='250' height='150' rx='20' fill='rgba(255,255,255,0.12)'/><rect x='960' y='92' width='120' height='12' rx='6' fill='rgba(255,255,255,0.8)'/><rect x='960' y='122' width='180' height='12' rx='6' fill='rgba(255,255,255,0.58)'/><rect x='960' y='152' width='160' height='12' rx='6' fill='rgba(255,255,255,0.4)'/>"
    };
  }

  return {
    escapeHtml,
    escapeAttribute,
    normalizeCategory,
    normalizeDate,
    normalizeCreatedAt,
    formatDate,
    sortNewsByDate,
    getDefaultRatings,
    sanitizeRatings,
    sanitizeNewsItem,
    isValidNewsItem,
    createCategoryHeader,
    getCategoryHeaderPosition
  };
})();
