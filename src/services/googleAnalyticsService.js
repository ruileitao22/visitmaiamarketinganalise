const { google } = require("googleapis");

function buildGoogleAuth() {
  const scopes = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly"
  ];

  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    const credentials = JSON.parse(inlineJson);
    return new google.auth.GoogleAuth({ credentials, scopes });
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile) {
    return new google.auth.GoogleAuth({ keyFile, scopes });
  }

  throw new Error("Credenciais Google não configuradas. Define GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_SERVICE_ACCOUNT_JSON.");
}

function parseMetric(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toIsoDateFromGa(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr || "";
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function toPercent(value) {
  return Number((Number(value || 0) * 100).toFixed(1));
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const toYmd = (d) => d.toISOString().slice(0, 10);
  return { startDate: toYmd(start), endDate: toYmd(end) };
}

function getPreviousDateRange(days) {
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const toYmd = (d) => d.toISOString().slice(0, 10);
  return { startDate: toYmd(start), endDate: toYmd(end) };
}

async function runGaReport(analyticsData, propertyId, requestBody) {
  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody
  });

  return response.data || {};
}

async function fetchGa4Data(authClient) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    throw new Error("GA4_PROPERTY_ID não definido.");
  }

  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });
  const last90 = getDateRange(90);
  const last30 = getDateRange(30);
  const last14 = getDateRange(14);
  const last7  = getDateRange(7);
  const prev90 = getPreviousDateRange(90);
  const prev30 = getPreviousDateRange(30);
  const prev14 = getPreviousDateRange(14);
  const prev7  = getPreviousDateRange(7);
  const comparisonMetrics = [
    { name: "activeUsers" },
    { name: "sessions" },
    { name: "engagementRate" },
    { name: "bounceRate" },
    { name: "conversions" }
  ];

  const [
    traffic, summaryReport, channelReport, deviceReport,
    audienceReport, countryReport, funnelReport,
    prevTraffic, prevSummary, last7Report, prev7Report,
    last14Report, prev14Report, last90SummaryReport, prev90SummaryReport
  ] = await Promise.all([
    // actuais
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last90],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }]
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      metrics: [
        { name: "activeUsers" }, { name: "sessions" },
        { name: "engagementRate" }, { name: "averageSessionDuration" },
        { name: "bounceRate" }, { name: "conversions" }
      ]
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }], limit: 20
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }], limit: 10
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      dimensions: [{ name: "newVsReturning" }],
      metrics: [{ name: "activeUsers" }], limit: 10
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }], limit: 5
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last30],
      metrics: [
        { name: "sessions" }, { name: "engagedSessions" },
        { name: "screenPageViews" }, { name: "conversions" }
      ]
    }),
    // períodos anteriores
    runGaReport(analyticsData, propertyId, {
      dateRanges: [prev90],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }]
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [prev30],
      metrics: [
        { name: "activeUsers" }, { name: "sessions" },
        { name: "engagementRate" }, { name: "averageSessionDuration" },
        { name: "bounceRate" }, { name: "conversions" }
      ]
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last7],
      metrics: comparisonMetrics
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [prev7],
      metrics: comparisonMetrics
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last14],
      metrics: comparisonMetrics
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [prev14],
      metrics: comparisonMetrics
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [last90],
      metrics: comparisonMetrics
    }),
    runGaReport(analyticsData, propertyId, {
      dateRanges: [prev90],
      metrics: comparisonMetrics
    })
  ]);

  const trafficSeries = (traffic.rows || []).map((row) => ({
    date: toIsoDateFromGa(row.dimensionValues[0].value),
    users: Math.round(parseMetric(row.metricValues[0].value))
  }));

  const summaryValues = summaryReport.rows && summaryReport.rows[0] ? summaryReport.rows[0].metricValues : [];
  const users = Math.round(parseMetric(summaryValues[0] && summaryValues[0].value));
  const sessions = Math.round(parseMetric(summaryValues[1] && summaryValues[1].value));
  const engagementRate = toPercent(summaryValues[2] && summaryValues[2].value);
  const avgSession = formatDuration(summaryValues[3] && summaryValues[3].value);
  const bounceRate = toPercent(summaryValues[4] && summaryValues[4].value);
  const conversions = Math.round(parseMetric(summaryValues[5] && summaryValues[5].value));
  const conversionRate = sessions > 0 ? Number(((conversions / sessions) * 100).toFixed(2)) : 0;

  const totalSessionsFromChannels = (channelReport.rows || []).reduce(
    (sum, row) => sum + parseMetric(row.metricValues[0].value),
    0
  );

  const channels = (channelReport.rows || [])
    .map((row) => {
      const rawName = row.dimensionValues[0].value || "(not set)";
      const value = parseMetric(row.metricValues[0].value);
      return {
        name: rawName === "Organic Search" ? "Orgânico" : rawName,
        value:
          totalSessionsFromChannels > 0
            ? Number(((value / totalSessionsFromChannels) * 100).toFixed(1))
            : 0
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const organicShare = channels.find((c) => c.name.toLowerCase().includes("org"))?.value || 0;

  const totalSessionsFromDevices = (deviceReport.rows || []).reduce(
    (sum, row) => sum + parseMetric(row.metricValues[0].value),
    0
  );

  const devices = (deviceReport.rows || []).map((row) => {
    const rawName = (row.dimensionValues[0].value || "").toLowerCase();
    let name = row.dimensionValues[0].value;
    if (rawName === "mobile") name = "Mobile";
    if (rawName === "desktop") name = "Desktop";
    if (rawName === "tablet") name = "Tablet";

    const value = parseMetric(row.metricValues[0].value);
    return {
      name,
      value: totalSessionsFromDevices > 0 ? Number(((value / totalSessionsFromDevices) * 100).toFixed(1)) : 0
    };
  });

  let newUsers = 0;
  let returning = 0;
  let audienceTotal = 0;

  (audienceReport.rows || []).forEach((row) => {
    const kind = (row.dimensionValues[0].value || "").toLowerCase();
    const value = parseMetric(row.metricValues[0].value);
    audienceTotal += value;

    if (kind.includes("new")) newUsers += value;
    if (kind.includes("return")) returning += value;
  });

  const countriesTotal = (countryReport.rows || []).reduce(
    (sum, row) => sum + parseMetric(row.metricValues[0].value),
    0
  );

  const countries = (countryReport.rows || []).map((row) => {
    const usersByCountry = parseMetric(row.metricValues[0].value);
    return {
      name: row.dimensionValues[0].value,
      value: countriesTotal > 0 ? Number(((usersByCountry / countriesTotal) * 100).toFixed(1)) : 0
    };
  });

  const funnelValues = funnelReport.rows && funnelReport.rows[0] ? funnelReport.rows[0].metricValues : [];
  const funnel = [
    { stage: "Sessões", value: Math.round(parseMetric(funnelValues[0] && funnelValues[0].value)) },
    { stage: "Sessões Envolvidas", value: Math.round(parseMetric(funnelValues[1] && funnelValues[1].value)) },
    { stage: "Cliques em Conteúdo", value: Math.round(parseMetric(funnelValues[2] && funnelValues[2].value)) },
    { stage: "Leads/Contactos", value: Math.round(parseMetric(funnelValues[3] && funnelValues[3].value)) }
  ];

  // ── Comparações ────────────────────────────────────────────────────────────
  function calcDelta(current, previous) {
    if (!previous || previous === 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  const prevTrafficSeries = (prevTraffic.rows || []).map((row) => ({
    date: toIsoDateFromGa(row.dimensionValues[0].value),
    users: Math.round(parseMetric(row.metricValues[0].value))
  }));

  const pv30 = prevSummary.rows && prevSummary.rows[0] ? prevSummary.rows[0].metricValues : [];
  const prevUsers30      = Math.round(parseMetric(pv30[0] && pv30[0].value));
  const prevSessions30   = Math.round(parseMetric(pv30[1] && pv30[1].value));
  const prevEngagement30 = toPercent(pv30[2] && pv30[2].value);
  const prevBounce30     = toPercent(pv30[4] && pv30[4].value);
  const prevConv30       = Math.round(parseMetric(pv30[5] && pv30[5].value));
  const prevConvRate30   = prevSessions30 > 0 ? Number(((prevConv30 / prevSessions30) * 100).toFixed(2)) : 0;

  function parseComparisonMetrics(values) {
    const metrics = values || [];
    const periodUsers = Math.round(parseMetric(metrics[0] && metrics[0].value));
    const periodSessions = Math.round(parseMetric(metrics[1] && metrics[1].value));
    const periodEngagement = toPercent(metrics[2] && metrics[2].value);
    const periodBounce = toPercent(metrics[3] && metrics[3].value);
    const periodConversions = Math.round(parseMetric(metrics[4] && metrics[4].value));
    const periodConversionRate =
      periodSessions > 0 ? Number(((periodConversions / periodSessions) * 100).toFixed(2)) : 0;

    return {
      users: periodUsers,
      sessions: periodSessions,
      engagementRate: periodEngagement,
      bounceRate: periodBounce,
      conversions: periodConversions,
      conversionRate: periodConversionRate
    };
  }

  const v7  = last7Report.rows && last7Report.rows[0] ? last7Report.rows[0].metricValues : [];
  const pv7 = prev7Report.rows && prev7Report.rows[0] ? prev7Report.rows[0].metricValues : [];
  const v14 = last14Report.rows && last14Report.rows[0] ? last14Report.rows[0].metricValues : [];
  const pv14 = prev14Report.rows && prev14Report.rows[0] ? prev14Report.rows[0].metricValues : [];
  const v90 = last90SummaryReport.rows && last90SummaryReport.rows[0] ? last90SummaryReport.rows[0].metricValues : [];
  const pv90 = prev90SummaryReport.rows && prev90SummaryReport.rows[0] ? prev90SummaryReport.rows[0].metricValues : [];

  const cur7 = parseComparisonMetrics(v7);
  const prev7Metrics = parseComparisonMetrics(pv7);
  const cur14 = parseComparisonMetrics(v14);
  const prev14Metrics = parseComparisonMetrics(pv14);
  const cur90 = parseComparisonMetrics(v90);
  const prev90Metrics = parseComparisonMetrics(pv90);

  const comparison = {
    period7: {
      label: "Últimos 7 dias vs 7 dias anteriores",
      current:  cur7,
      previous: prev7Metrics,
      deltas: {
        users:          calcDelta(cur7.users,          prev7Metrics.users),
        sessions:       calcDelta(cur7.sessions,       prev7Metrics.sessions),
        engagementRate: calcDelta(cur7.engagementRate, prev7Metrics.engagementRate),
        bounceRate:     calcDelta(cur7.bounceRate,     prev7Metrics.bounceRate),
        conversions:    calcDelta(cur7.conversions,    prev7Metrics.conversions),
        conversionRate: calcDelta(cur7.conversionRate, prev7Metrics.conversionRate)
      }
    },
    period14: {
      label: "Últimos 14 dias vs 14 dias anteriores",
      current: cur14,
      previous: prev14Metrics,
      deltas: {
        users:          calcDelta(cur14.users,          prev14Metrics.users),
        sessions:       calcDelta(cur14.sessions,       prev14Metrics.sessions),
        engagementRate: calcDelta(cur14.engagementRate, prev14Metrics.engagementRate),
        bounceRate:     calcDelta(cur14.bounceRate,     prev14Metrics.bounceRate),
        conversions:    calcDelta(cur14.conversions,    prev14Metrics.conversions),
        conversionRate: calcDelta(cur14.conversionRate, prev14Metrics.conversionRate)
      }
    },
    period30: {
      label: "Últimos 30 dias vs 30 dias anteriores",
      current:  { users, sessions, engagementRate, bounceRate, conversions, conversionRate },
      previous: { users: prevUsers30, sessions: prevSessions30, engagementRate: prevEngagement30, bounceRate: prevBounce30, conversions: prevConv30, conversionRate: prevConvRate30 },
      deltas: {
        users:          calcDelta(users,          prevUsers30),
        sessions:       calcDelta(sessions,       prevSessions30),
        engagementRate: calcDelta(engagementRate, prevEngagement30),
        bounceRate:     calcDelta(bounceRate,     prevBounce30),
        conversions:    calcDelta(conversions,    prevConv30),
        conversionRate: calcDelta(conversionRate, prevConvRate30)
      }
    },
    period90: {
      label: "Últimos 90 dias vs 90 dias anteriores",
      current: cur90,
      previous: prev90Metrics,
      deltas: {
        users:          calcDelta(cur90.users,          prev90Metrics.users),
        sessions:       calcDelta(cur90.sessions,       prev90Metrics.sessions),
        engagementRate: calcDelta(cur90.engagementRate, prev90Metrics.engagementRate),
        bounceRate:     calcDelta(cur90.bounceRate,     prev90Metrics.bounceRate),
        conversions:    calcDelta(cur90.conversions,    prev90Metrics.conversions),
        conversionRate: calcDelta(cur90.conversionRate, prev90Metrics.conversionRate)
      }
    }
  };

  return {
    summary: {
      users,
      sessions,
      engagementRate,
      avgSession,
      organicShare,
      bounceRate,
      conversions,
      conversionRate
    },
    trafficSeries,
    prevTrafficSeries,
    channels,
    devices,
    audience: {
      newUsers: audienceTotal > 0 ? Number(((newUsers / audienceTotal) * 100).toFixed(1)) : 0,
      returning: audienceTotal > 0 ? Number(((returning / audienceTotal) * 100).toFixed(1)) : 0,
      countries
    },
    funnel,
    comparison
  };
}

function mapSearchConsoleRows(rows, keyFieldName) {
  return (rows || []).map((row) => {
    const key = row.keys && row.keys[0] ? row.keys[0] : "";
    return {
      [keyFieldName]: key,
      clicks: Math.round(parseMetric(row.clicks)),
      impressions: Math.round(parseMetric(row.impressions)),
      ctr: Number((parseMetric(row.ctr) * 100).toFixed(1)),
      position: Number(parseMetric(row.position).toFixed(1))
    };
  });
}

async function fetchSearchConsoleData(authClient) {
  const siteUrl = process.env.GSC_SITE_URL || "sc-domain:visitmaia.pt";
  const webmasters = google.webmasters({ version: "v3", auth: authClient });
  const { startDate, endDate } = getDateRange(30);

  try {
    const [queryResp, pageResp] = await Promise.all([
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 20 }
      }),
      webmasters.searchanalytics.query({
        siteUrl,
        requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 20 }
      })
    ]);

    const topQueries = mapSearchConsoleRows(queryResp.data.rows, "query");
    const topPages = mapSearchConsoleRows(pageResp.data.rows, "page").map((row) => {
      if (!row.page) return row;
      try {
        const url = new URL(row.page);
        return { ...row, page: url.pathname || "/" };
      } catch (_) { return row; }
    });

    return { topQueries, topPages };
  } catch (err) {
    console.warn(`[gsc] Search Console indisponível: ${err.message}`);
    return { topQueries: [], topPages: [] };
  }
}

async function fetchRealAnalyticsBundle() {
  const auth = buildGoogleAuth();
  const authClient = await auth.getClient();

  const [ga, gsc] = await Promise.all([
    fetchGa4Data(authClient),
    fetchSearchConsoleData(authClient)
  ]);

  return {
    ...ga,
    topQueries: gsc.topQueries,
    topPages: gsc.topPages,
    meta: {
      source: "ga4+search_console",
      fetchedAt: new Date().toISOString(),
      siteUrl: process.env.GSC_SITE_URL || "sc-domain:visitmaia.pt"
    }
  };
}

module.exports = {
  fetchRealAnalyticsBundle
};
