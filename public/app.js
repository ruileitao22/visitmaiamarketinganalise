
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");

const loginForm = document.getElementById("loginForm");
const loginIdentifier = document.getElementById("loginIdentifier");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");

const statusMsg = document.getElementById("statusMsg");
const rangeSelect = document.getElementById("rangeSelect");
const syncBtn = document.getElementById("syncBtn");
const logoutBtn = document.getElementById("logoutBtn");
const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
const currentUserLabel = document.getElementById("currentUserLabel");

const kpiGrid = document.getElementById("kpiGrid");
const lineTotal = document.getElementById("lineTotal");
const trafficSvg = document.getElementById("trafficSvg");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const dailyAvg = document.getElementById("dailyAvg");
const channelsList = document.getElementById("channelsList");
const deviceList = document.getElementById("deviceList");
const deviceMain = document.getElementById("deviceMain");
const queryTable = document.getElementById("queryTable");
const pagesTable = document.getElementById("pagesTable");
const audienceList = document.getElementById("audienceList");
const geoList = document.getElementById("geoList");
const funnelList = document.getElementById("funnelList");
const funnelRate = document.getElementById("funnelRate");

const createUserForm = document.getElementById("createUserForm");
const newUserEmail = document.getElementById("newUserEmail");
const newUserPassword = document.getElementById("newUserPassword");
const newUsername = document.getElementById("newUsername");
const userMessage = document.getElementById("userMessage");
const usersTable = document.getElementById("usersTable");
const changePasswordForm = document.getElementById("changePasswordForm");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");

let currentData = null;
let currentUser = null;
const defaultAdminUsername = "admin";
window.currentData = null;
const brandColors = {
  primary: "#00a8c6",
  secondary: "#0c6f83",
  accent: "#e84b5f",
  warning: "#f2cf63",
  grid: "#d6e3ea",
  label: "#5f7580"
};

bootstrap();

async function bootstrap() {
  try {
    const me = await apiFetch("/api/auth/me");
    currentUser = me.user;
    showApp();
    await Promise.all([loadDashboard(false), loadUsers()]);
  } catch (_) {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  loginMessage.textContent = "A autenticar...";
  try {
    const body = {
      identifier: loginIdentifier.value.trim(),
      password: loginPassword.value
    };

    const resp = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body)
    });

    currentUser = resp.user;
    loginPassword.value = "";
    showApp();
    await Promise.all([loadDashboard(false), loadUsers()]);
  } catch (err) {
    loginMessage.textContent = err.message;
  }
});

async function handleLogout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (_) {
    // sem ação
  }

  currentUser = null;
  currentData = null;
  window.currentData = null;
  showLogin();
}

logoutBtn.addEventListener("click", handleLogout);
if (mobileLogoutBtn) {
  mobileLogoutBtn.addEventListener("click", handleLogout);
}

syncBtn.addEventListener("click", async () => {
  await loadDashboard(true);
});

rangeSelect.addEventListener("change", () => {
  if (currentData) renderAll();
});

createUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  userMessage.textContent = "A criar utilizador...";
  try {
    await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: newUserEmail.value.trim(),
        password: newUserPassword.value,
        username: newUsername.value.trim() || undefined
      })
    });

    newUserEmail.value = "";
    newUserPassword.value = "";
    newUsername.value = "";

    userMessage.textContent = "Utilizador criado com sucesso.";
    await loadUsers();
  } catch (err) {
    userMessage.textContent = err.message;
  }
});

changePasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (newPassword !== confirmPassword) {
    passwordMessage.textContent = "A nova password e a confirmação não coincidem.";
    return;
  }

  passwordMessage.textContent = "A atualizar password...";
  try {
    await apiFetch("/api/users/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword
      })
    });

    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    passwordMessage.textContent = "Password alterada com sucesso.";
  } catch (err) {
    passwordMessage.textContent = err.message;
  }
});

usersTable.addEventListener("click", async (e) => {
  const button = e.target.closest(".btn-delete-user");
  if (!button) return;

  if (!isCurrentUserAdmin()) {
    userMessage.textContent = "Apenas a conta admin pode apagar utilizadores.";
    return;
  }

  const targetId = Number(button.dataset.userId);
  const targetUsername = String(button.dataset.username || "utilizador");
  if (!Number.isInteger(targetId) || targetId <= 0) {
    userMessage.textContent = "ID de utilizador inválido.";
    return;
  }

  const confirmed = window.confirm(`Queres mesmo apagar a conta "${targetUsername}"?`);
  if (!confirmed) return;

  button.disabled = true;
  userMessage.textContent = "A apagar utilizador...";

  try {
    await apiFetch(`/api/users/${targetId}`, { method: "DELETE" });
    userMessage.textContent = `Conta "${targetUsername}" apagada com sucesso.`;
    await loadUsers();
  } catch (err) {
    userMessage.textContent = err.message;
    button.disabled = false;
  }
});

async function loadDashboard(force) {
  setStatus(force ? "A sincronizar com Google APIs..." : "A carregar dados do dashboard...", "ok");

  try {
    const endpoint = force ? "/api/dashboard/sync" : "/api/dashboard";
    const method = force ? "POST" : "GET";
    const result = await apiFetch(endpoint, { method });

    currentData = result.data;
    window.currentData = currentData;
    renderAll();

    if (result.warning) {
      setStatus(result.warning, "warn");
    } else {
      const when = result.fetchedAt ? new Date(result.fetchedAt).toLocaleString("pt-PT") : "agora";
      setStatus(`Dados carregados (${result.source}) - ${when}`, "ok");
    }
  } catch (err) {
    setStatus("Falha ao carregar dashboard: " + err.message, "error");
  }
}

async function loadUsers() {
  try {
    const { users } = await apiFetch("/api/users");

    usersTable.innerHTML = users
      .map(
        (u) => `
        <tr>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${formatDateTime(u.created_at)}</td>
          <td class="users-action-cell">
            ${
              canDeleteUser(u)
                ? `<button class="btn-delete btn-delete-user" type="button" data-user-id="${Number(u.id)}" data-username="${escapeHtml(u.username)}">Apagar</button>`
                : `<span class="users-action-muted">—</span>`
            }
          </td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    userMessage.textContent = "Erro ao carregar utilizadores: " + err.message;
  }
}

function showLogin() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  loginMessage.textContent = "";
}

function showApp() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  currentUserLabel.textContent = currentUser
    ? `Sessão: ${currentUser.username} (${currentUser.email})`
    : "";
}

function canDeleteUser(user) {
  if (!isCurrentUserAdmin()) return false;
  if (!user || !Number.isInteger(Number(user.id))) return false;
  if (Number(user.id) === Number(currentUser && currentUser.id)) return false;
  if (isAdminAccount(user)) return false;
  return true;
}

function isCurrentUserAdmin() {
  if (currentUser && typeof currentUser.isAdmin === "boolean") {
    return currentUser.isAdmin;
  }
  return normalizeIdentity(currentUser && currentUser.username) === defaultAdminUsername;
}

function isAdminAccount(user) {
  if (!user) return false;
  if (typeof user.isAdmin === "boolean") return user.isAdmin;
  return normalizeIdentity(user.username) === defaultAdminUsername;
}

function setStatus(message, type) {
  statusMsg.textContent = message;
  statusMsg.className = "status-badge";
  if (type === "warn") statusMsg.classList.add("warn");
  if (type === "error") statusMsg.classList.add("error");
}

function renderAll() {
  if (!currentData) return;

  const summary = currentData.summary || {};
  renderKpis(summary);
  renderTraffic(currentData.trafficSeries || [], Number(rangeSelect.value));
  renderBars(channelsList, currentData.channels || []);
  renderDevices(currentData.devices || []);
  renderQueryTable(currentData.topQueries || []);
  renderPagesTable(currentData.topPages || []);
  renderAudience(currentData.audience || {});
  renderFunnel(currentData.funnel || []);
  renderCompare("period7");

  document.querySelectorAll(".compare-tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".compare-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderCompare(btn.dataset.period);
    };
  });
}

function renderKpis(summary) {
  const kpis = [
    { title: "Utilizadores", value: formatInt(summary.users), delta: "Atual" },
    { title: "Sessões", value: formatInt(summary.sessions), delta: "Atual" },
    { title: "Taxa de Envolvimento", value: toPct(summary.engagementRate), delta: "GA4" },
    { title: "Duração Média", value: summary.avgSession || "00:00", delta: "GA4" },
    { title: "Tráfego Orgânico", value: toPct(summary.organicShare), delta: "Canal" },
    { title: "Bounce Rate", value: toPct(summary.bounceRate), delta: "GA4" },
    { title: "Conversões", value: formatInt(summary.conversions), delta: "GA4" },
    { title: "Taxa de Conversão", value: toPct(summary.conversionRate), delta: "Sessões -> Conversões" }
  ];

  kpiGrid.innerHTML = kpis
    .map(
      (k) => `
      <article class="card">
        <div class="kpi-title">${escapeHtml(k.title)}</div>
        <div class="kpi-value">${escapeHtml(k.value)}</div>
        <div class="kpi-delta"><strong>${escapeHtml(k.delta)}</strong></div>
      </article>
    `
    )
    .join("");
}

function renderTraffic(series, range) {
  const view = series.slice(-range);
  const values = view.map((i) => Number(i.users || 0));
  const labels = view.map((i) => i.date);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;

  lineTotal.textContent = formatInt(total) + " utilizadores";
  startDate.textContent = labels[0] || "-";
  endDate.textContent = labels[labels.length - 1] || "-";
  dailyAvg.textContent = formatInt(Math.round(avg));

  drawLineChart(trafficSvg, values.length ? values : [0]);
}

function drawLineChart(svg, values) {
  const w = 760;
  const h = 320;
  const p = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  const pts = values.map((v, i) => {
    const x = p + (i * (w - p * 2)) / Math.max(values.length - 1, 1);
    const y = h - p - ((v - min) / span) * (h - p * 2);
    return [x, y];
  });

  const path = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0].toFixed(2)},${pt[1].toFixed(2)}`).join(" ");
  const area = `${path} L${w - p},${h - p} L${p},${h - p} Z`;

  const yTicks = 4;
const lines = [];
const labels = [];

for (let i = 0; i <= yTicks; i++) {
  const y = p + (i * (h - p * 2)) / yTicks;
  const value = Math.round(max - (i * (max - min)) / yTicks);

  lines.push(`<line x1="${p}" y1="${y}" x2="${w - p}" y2="${y}" stroke="${brandColors.grid}" stroke-dasharray="3 5" />`);

  labels.push(`
    <text x="${p - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${brandColors.label}">
      ${value}
    </text>
  `);
}

  svg.innerHTML = `
    <defs>
      <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(0,168,198,0.34)" />
        <stop offset="100%" stop-color="rgba(0,168,198,0.04)" />
      </linearGradient>
    </defs>
    ${lines.join("")}
    ${labels.join("")}
    <path d="${area}" fill="url(#gradArea)" />
    <path d="${path}" fill="none" stroke="${brandColors.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.7" fill="#fff" stroke="${brandColors.primary}" stroke-width="2" />`).join("")}
  `;
}

function renderBars(target, data) {
  target.innerHTML = (data || [])
    .map(
      (item) => `
      <div class="bar-row">
        <span>${escapeHtml(item.name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Number(item.value || 0).toFixed(1)}%"></div></div>
        <strong>${toPct(item.value)}</strong>
      </div>
    `
    )
    .join("");
}

function renderDevices(devices) {
  renderBars(deviceList, devices);

  const top = [...(devices || [])].sort((a, b) => b.value - a.value)[0];
  if (top) {
    deviceMain.textContent = toPct(top.value);
  }

  const [a = 0, b = 0] = (devices || []).map((d) => Number(d.value || 0));
  const donut = document.getElementById("deviceDonut");
  donut.style.background = `conic-gradient(var(--primary) 0% ${a}%, var(--accent) ${a}% ${a + b}%, #d6e3ea ${a + b}% 100%)`;

  const oldLegend = donut.parentElement.querySelector(".legend");
  if (oldLegend) oldLegend.remove();

  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = `
    <span><i style="background: var(--primary);"></i>Mobile</span>
    <span><i style="background: var(--accent);"></i>Desktop</span>
    <span><i style="background: #d6e3ea;"></i>Tablet</span>
  `;
  donut.parentElement.appendChild(legend);
}

function renderQueryTable(rows) {
  queryTable.innerHTML = (rows || [])
    .slice(0, 20)
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.query)}</td>
        <td>${formatInt(r.clicks)}</td>
        <td>${formatInt(r.impressions)}</td>
        <td>${toPct(r.ctr)}</td>
        <td>${Number(r.position || 0).toFixed(1)}</td>
      </tr>
    `
    )
    .join("");
}

function renderPagesTable(rows) {
  pagesTable.innerHTML = (rows || [])
    .slice(0, 20)
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.page)}</td>
        <td>${formatInt(r.clicks)}</td>
        <td>${formatInt(r.impressions)}</td>
        <td>${toPct(r.ctr)}</td>
        <td>${Number(r.position || 0).toFixed(1)}</td>
      </tr>
    `
    )
    .join("");
}

function renderAudience(audience) {
  renderBars(audienceList, [
    { name: "Novos", value: Number(audience.newUsers || 0) },
    { name: "Recorrentes", value: Number(audience.returning || 0) }
  ]);

  renderBars(geoList, audience.countries || []);
}

function renderFunnel(steps) {
  const normalized = steps || [];
  const first = Number(normalized[0]?.value || 0);
  const last  = Number(normalized[normalized.length - 1]?.value || 0);
  const rate  = first > 0 ? (last / first) * 100 : 0;
  funnelRate.textContent = toPct(rate);

  const colors = [
    { bg: brandColors.secondary, text: "#fff" },
    { bg: brandColors.primary, text: "#fff" },
    { bg: brandColors.warning, text: "#5f4500" },
    { bg: brandColors.accent, text: "#fff" }
  ];

  funnelList.innerHTML = `
    <div class="funnel-visual">
      ${normalized.map((step, i) => {
        const prev  = i > 0 ? Number(normalized[i-1].value || 0) : Number(step.value);
        const val   = Number(step.value || 0);
        const drop  = i === 0 ? 0 : prev > 0 ? ((prev - val) / prev) * 100 : 0;
        const wpct  = first > 0 ? Math.max((val / first) * 100, 8) : 100;
        const conv  = first > 0 ? (val / first) * 100 : 0;
        const c     = colors[i % colors.length];
        const cls   = drop > 50 ? "high" : drop > 25 ? "mid" : "low";

        return `
          <div class="funnel-item" onclick="toggleFunnelDetail(${i})">
            <div class="funnel-bar-wrap">
              <div class="funnel-bar" style="width:${wpct}%;background:${c.bg}">
                <div class="funnel-bar-label" style="color:${c.text}">
                  <strong>${escapeHtml(step.stage)}</strong>
                  <span>${formatInt(val)}</span>
                </div>
              </div>
              ${i > 0
                ? `<span class="funnel-drop ${cls}">▼ ${toPct(drop)} saíram</span>`
                : `<span class="funnel-drop low">Entrada</span>`}
            </div>
            <div class="funnel-detail hidden" id="fd-${i}">
              <div class="funnel-detail-grid">
                <div class="funnel-stat"><span>Utilizadores</span><strong>${formatInt(val)}</strong></div>
                <div class="funnel-stat"><span>% do total</span><strong>${toPct(conv)}</strong></div>
                ${i > 0 ? `<div class="funnel-stat danger"><span>Abandonaram</span><strong>${formatInt(prev - val)}</strong></div>` : ""}
                ${i > 0 ? `<div class="funnel-stat danger"><span>Taxa abandono</span><strong>${toPct(drop)}</strong></div>` : ""}
              </div>
            </div>
          </div>`;
      }).join("")}
    </div>
    <div class="funnel-summary">
      <div class="funnel-summary-item"><span>Entrada</span><strong>${formatInt(first)}</strong></div>
      <span class="funnel-summary-arrow">→</span>
      <div class="funnel-summary-item"><span>Conversões</span><strong>${formatInt(last)}</strong></div>
      <span class="funnel-summary-arrow">→</span>
      <div class="funnel-summary-item highlight"><span>Taxa global</span><strong>${toPct(rate)}</strong></div>
    </div>`;
}

function toggleFunnelDetail(i) {
  document.getElementById(`fd-${i}`)?.classList.toggle("hidden");
}

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {
    // no-op
  }

  if (!response.ok) {
    throw new Error(payload.error || `Erro HTTP ${response.status}`);
  }

  return payload;
}

function formatInt(value) {
  return Number(value || 0).toLocaleString("pt-PT");
}

function toPct(value) {
  return Number(value || 0).toFixed(1).replace(".", ",") + "%";
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-PT");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

// ── Comparações ────────────────────────────────────────────────────────────

function renderCompare(period) {
  if (!currentData?.comparison) return;
  const data = normalizeComparisonPeriod(currentData.comparison[period] || {});
  if (!data) return;

  const lbl = document.getElementById("comparePeriodLabel");
  if (lbl) lbl.textContent = data.label;

  const metrics = [
    { key: "users",          label: "Utilizadores",      fmt: formatInt,       lowerIsBetter: false },
    { key: "sessions",       label: "Sessões",           fmt: formatInt,       lowerIsBetter: false },
    { key: "engagementRate", label: "Envolvimento",      fmt: v => toPct(v),   lowerIsBetter: false },
    { key: "bounceRate",     label: "Bounce Rate",       fmt: v => toPct(v),   lowerIsBetter: true  },
    { key: "conversions",    label: "Conversões",        fmt: formatInt,       lowerIsBetter: false },
    { key: "conversionRate", label: "Taxa Conversão",    fmt: v => toPct(v),   lowerIsBetter: false },
  ];

  const kpisEl = document.getElementById("compareKpis");
  if (kpisEl) {
    kpisEl.innerHTML = metrics.map(m => {
      const cur   = data.current[m.key]  ?? 0;
      const prev  = data.previous[m.key] ?? 0;
      const delta = data.deltas?.[m.key];
      const wpct  = prev > 0 ? Math.min((cur / Math.max(cur, prev)) * 100, 100) : 0;

      let badge = `<span class="compare-delta delta-neutral">—</span>`;
      if (delta !== null && delta !== undefined) {
        const good  = m.lowerIsBetter ? delta < 0 : delta > 0;
        const sign  = delta > 0 ? "+" : "";
        const arrow = delta > 0 ? "↑" : "↓";
        badge = `<span class="compare-delta ${good ? "delta-up" : "delta-down"}">${arrow} ${sign}${delta}%</span>`;
      }

      return `
        <div class="compare-kpi">
          <span class="compare-kpi-label">${m.label}</span>
          <div class="compare-kpi-values">
            <strong class="compare-kpi-cur">${m.fmt(cur)}</strong>
            <span class="compare-kpi-prev">vs ${m.fmt(prev)}</span>
            ${badge}
          </div>
          <div class="compare-bar-track">
            <div class="compare-bar-fill" style="width:${wpct.toFixed(1)}%"></div>
          </div>
        </div>`;
    }).join("");
  }

  const periodDays = {
    period7: 7,
    period14: 14,
    period30: 30,
    period90: 90
  };
  const days = periodDays[period] || 30;
  drawCompareChart(
    document.getElementById("compareChartSvg"),
    (currentData.trafficSeries     || []).slice(-days),
    (currentData.prevTrafficSeries || []).slice(-days)
  );
}

function normalizeComparisonPeriod(periodData) {
  const base = periodData || {};
  const currentRaw = base.current || {};
  const previousRaw = base.previous || {};

  const current = normalizeComparisonMetrics(currentRaw);
  const previous = normalizeComparisonMetrics(previousRaw);
  const deltaRaw = base.deltas || {};

  return {
    ...base,
    current,
    previous,
    deltas: {
      users:          normalizeDelta(deltaRaw.users, current.users, previous.users),
      sessions:       normalizeDelta(deltaRaw.sessions, current.sessions, previous.sessions),
      engagementRate: normalizeDelta(deltaRaw.engagementRate, current.engagementRate, previous.engagementRate),
      bounceRate:     normalizeDelta(deltaRaw.bounceRate, current.bounceRate, previous.bounceRate),
      conversions:    normalizeDelta(deltaRaw.conversions, current.conversions, previous.conversions),
      conversionRate: normalizeDelta(deltaRaw.conversionRate, current.conversionRate, previous.conversionRate)
    }
  };
}

function normalizeComparisonMetrics(metrics) {
  const safe = metrics || {};
  const sessions = asNumber(safe.sessions);
  const conversions = asNumber(safe.conversions);
  const computedConversionRate =
    sessions > 0 ? Number(((conversions / sessions) * 100).toFixed(2)) : 0;

  return {
    users: asNumber(safe.users),
    sessions,
    engagementRate: asNumber(safe.engagementRate),
    bounceRate: asNumber(safe.bounceRate),
    conversions,
    conversionRate:
      safe.conversionRate === undefined || safe.conversionRate === null
        ? computedConversionRate
        : asNumber(safe.conversionRate)
  };
}

function normalizeDelta(deltaValue, currentValue, previousValue) {
  if (deltaValue === null) return null;
  if (deltaValue !== undefined && deltaValue !== "") return asNumber(deltaValue);
  if (!previousValue) return null;
  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
}

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function drawCompareChart(svg, cur, prev) {
  if (!svg) return;
  const all  = [...cur.map(d => d.users), ...prev.map(d => d.users)];
  const maxV = Math.max(...all, 1);
  const W = 900, H = 220;
  const pL = 52, pR = 16, pT = 14, pB = 34;
  const gW = W - pL - pR, gH = H - pT - pB;
  const len = Math.max(cur.length, prev.length, 1);

  const px = i => pL + (i / Math.max(len - 1, 1)) * gW;
  const py = v => pT + gH - (v / maxV) * gH;

  const path = (series, color, dash = "") => {
    if (!series.length) return "";
    const d = series.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.users).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}" stroke-linejoin="round" stroke-linecap="round"/>`;
  };

  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((maxV / 4) * i);
    const y = py(v);
    grid += `<text x="${pL - 6}" y="${y + 4}" text-anchor="end" class="chart-label">${v}</text>`;
    grid += `<line x1="${pL}" y1="${y}" x2="${W - pR}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`;
  }

  let xAxis = "";
  const step = Math.max(1, Math.floor(len / 6));
  for (let i = 0; i < len; i += step) {
    if (cur[i]) xAxis += `<text x="${px(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="chart-label">${cur[i].date.slice(5)}</text>`;
  }

  svg.innerHTML = grid + xAxis + path(prev, "var(--muted)", "5,4") + path(cur, "var(--primary)");
}
