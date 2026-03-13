function buildDemoData() {
  const today = new Date();
  const trafficSeries = [];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const season = Math.sin(i / 8) * 120;
    const noise = ((i * 73) % 110);
    const base = weekend ? 780 : 980;

    trafficSeries.push({
      date: d.toISOString().slice(0, 10),
      users: Math.round(base + season + noise)
    });
  }

  const prevTrafficSeries = trafficSeries.map((item, idx) => ({
    date: item.date,
    users: Math.max(0, Math.round(item.users * (0.89 + ((idx % 9) * 0.006))))
  }));

  const comparison = {
    period7: {
      label: "Últimos 7 dias vs 7 dias anteriores",
      current: { users: 11240, sessions: 14580, engagementRate: 65.1, bounceRate: 34.2, conversions: 295, conversionRate: 2.02 },
      previous: { users: 10680, sessions: 13720, engagementRate: 63.4, bounceRate: 36.1, conversions: 261, conversionRate: 1.9 },
      deltas: { users: 5.2, sessions: 6.3, engagementRate: 2.7, bounceRate: -5.3, conversions: 13.0, conversionRate: 6.3 }
    },
    period14: {
      label: "Últimos 14 dias vs 14 dias anteriores",
      current: { users: 21870, sessions: 28140, engagementRate: 64.9, bounceRate: 35.0, conversions: 562, conversionRate: 2.0 },
      previous: { users: 20620, sessions: 26610, engagementRate: 63.8, bounceRate: 36.5, conversions: 511, conversionRate: 1.92 },
      deltas: { users: 6.1, sessions: 5.7, engagementRate: 1.7, bounceRate: -4.1, conversions: 10.0, conversionRate: 4.2 }
    },
    period30: {
      label: "Últimos 30 dias vs 30 dias anteriores",
      current: { users: 52460, sessions: 67720, engagementRate: 64.8, bounceRate: 35.2, conversions: 1380, conversionRate: 2.04 },
      previous: { users: 49810, sessions: 64210, engagementRate: 63.2, bounceRate: 36.9, conversions: 1246, conversionRate: 1.94 },
      deltas: { users: 5.3, sessions: 5.5, engagementRate: 2.5, bounceRate: -4.6, conversions: 10.8, conversionRate: 5.2 }
    },
    period90: {
      label: "Últimos 90 dias vs 90 dias anteriores",
      current: { users: 156930, sessions: 201180, engagementRate: 63.9, bounceRate: 36.1, conversions: 4020, conversionRate: 2.0 },
      previous: { users: 148220, sessions: 191460, engagementRate: 62.7, bounceRate: 37.2, conversions: 3654, conversionRate: 1.91 },
      deltas: { users: 5.9, sessions: 5.1, engagementRate: 1.9, bounceRate: -3.0, conversions: 10.0, conversionRate: 4.7 }
    }
  };

  return {
    summary: {
      users: 52460,
      sessions: 67720,
      engagementRate: 64.8,
      avgSession: "02:41",
      organicShare: 58.6,
      bounceRate: 35.2,
      conversions: 1380,
      conversionRate: 2.04
    },
    trafficSeries,
    prevTrafficSeries,
    channels: [
      { name: "Orgânico", value: 58.6 },
      { name: "Direto", value: 21.2 },
      { name: "Social", value: 10.8 },
      { name: "Referral", value: 6.1 },
      { name: "Pago", value: 3.3 }
    ],
    devices: [
      { name: "Mobile", value: 68.2 },
      { name: "Desktop", value: 27.1 },
      { name: "Tablet", value: 4.7 }
    ],
    audience: {
      newUsers: 72,
      returning: 28,
      countries: [
        { name: "Portugal", value: 78 },
        { name: "Espanha", value: 8 },
        { name: "França", value: 4.5 },
        { name: "Brasil", value: 3.7 },
        { name: "Outros", value: 5.8 }
      ]
    },
    topQueries: [
      { query: "eventos maia", clicks: 1480, impressions: 15980, ctr: 9.3, position: 2.2 },
      { query: "o que visitar maia", clicks: 1310, impressions: 11840, ctr: 11.1, position: 1.9 },
      { query: "restaurantes maia", clicks: 1090, impressions: 13500, ctr: 8.1, position: 3.4 },
      { query: "agenda cultural maia", clicks: 840, impressions: 7750, ctr: 10.8, position: 2.6 },
      { query: "turismo maia portugal", clicks: 720, impressions: 5200, ctr: 13.8, position: 1.7 },
      { query: "alojamento maia", clicks: 580, impressions: 6700, ctr: 8.6, position: 4.1 },
      { query: "parques maia", clicks: 470, impressions: 3800, ctr: 12.4, position: 2.8 }
    ],
    topPages: [
      { page: "/", clicks: 3120, impressions: 42400, ctr: 7.4, position: 3.2 },
      { page: "/eventos", clicks: 2410, impressions: 25280, ctr: 9.5, position: 2.5 },
      { page: "/o-que-fazer", clicks: 1890, impressions: 19840, ctr: 9.5, position: 2.8 },
      { page: "/onde-comer", clicks: 1450, impressions: 17390, ctr: 8.3, position: 3.6 },
      { page: "/como-chegar", clicks: 1020, impressions: 9420, ctr: 10.8, position: 2.3 },
      { page: "/roteiros", clicks: 790, impressions: 8330, ctr: 9.5, position: 2.9 }
    ],
    funnel: [
      { stage: "Sessões", value: 67720 },
      { stage: "Sessões Engajadas", value: 43860 },
      { stage: "Cliques em Conteúdo", value: 12730 },
      { stage: "Leads/Contactos", value: 1380 }
    ],
    comparison,
    meta: {
      source: "demo",
      fetchedAt: new Date().toISOString()
    }
  };
}

module.exports = { buildDemoData };
