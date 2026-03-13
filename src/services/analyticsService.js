const { getAnalyticsCache, setAnalyticsCache } = require("../db/store");
const { buildDemoData } = require("./demoData");
const { fetchRealAnalyticsBundle } = require("./googleAnalyticsService");

const CACHE_MAX_HOURS = Number(process.env.CACHE_MAX_HOURS || 24);

function getCacheRow() {
  return getAnalyticsCache();
}

function saveCache(payload, source) {
  const fetchedAt = new Date().toISOString();
  setAnalyticsCache({ payload, source, fetchedAt });

  return { payload, source, fetchedAt };
}

function hydrateCacheRow(row) {
  if (!row) return null;
  if (!row.payload) return null;

  return {
    payload: row.payload,
    source: row.source,
    fetchedAt: row.fetched_at
  };
}

function isStale(isoDate, maxHours = CACHE_MAX_HOURS) {
  if (!isoDate) return true;
  const ageMs = Date.now() - new Date(isoDate).getTime();
  return ageMs > maxHours * 60 * 60 * 1000;
}

async function fetchAndCacheRealData() {
  const bundle = await fetchRealAnalyticsBundle();
  const saved = saveCache(bundle, "real");
  return {
    data: saved.payload,
    source: "real",
    fetchedAt: saved.fetchedAt,
    stale: false
  };
}

function getDemoResult() {
  const demo = buildDemoData();
  return {
    data: demo,
    source: "demo",
    fetchedAt: demo.meta.fetchedAt,
    stale: false,
    warning: "A mostrar dados de demonstração: credenciais GA4/Search Console ausentes ou inválidas."
  };
}

async function getAnalyticsData(options = {}) {
  const { forceRefresh = false } = options;

  const cached = hydrateCacheRow(getCacheRow());

  if (!forceRefresh && cached && !isStale(cached.fetchedAt)) {
    return {
      data: cached.payload,
      source: cached.source,
      fetchedAt: cached.fetchedAt,
      stale: false
    };
  }

  try {
    return await fetchAndCacheRealData();
  } catch (error) {
    if (cached) {
      return {
        data: cached.payload,
        source: cached.source,
        fetchedAt: cached.fetchedAt,
        stale: true,
        warning: "Sem ligação ao Google neste momento. A mostrar último cache disponível.",
        error: error.message
      };
    }

    const demo = getDemoResult();
    return {
      ...demo,
      error: error.message
    };
  }
}

async function refreshAnalyticsDataJob() {
  try {
    const result = await fetchAndCacheRealData();
    console.log(`[scheduler] dashboard atualizado com dados reais em ${result.fetchedAt}`);
  } catch (err) {
    console.error(`[scheduler] falha ao atualizar dados: ${err.message}`);
  }
}

module.exports = {
  getAnalyticsData,
  refreshAnalyticsDataJob
};
