require("dotenv").config();

const path = require("path");
const express = require("express");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

const {
  findUserByIdentifier,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  insertUser,
  listUsers,
  deleteUser,
  updateUserPassword
} = require("./db/store");
const { signUserToken } = require("./services/authService");
const { requireAuth } = require("./middleware/requireAuth");
const { getAnalyticsData } = require("./services/analyticsService");
const { startScheduler } = require("./services/scheduler");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const authFailureMessage = "Palavra chave errada contacte o administrador.";

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(process.cwd(), "public")));

function setAuthCookie(res, token) {
  res.cookie("auth_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 12 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie("auth_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const adminIdentity = {
  username: normalizeIdentity(process.env.INITIAL_ADMIN_USER || "admin"),
  email: normalizeIdentity(process.env.INITIAL_ADMIN_EMAIL || "")
};

function isAdminUser(user) {
  if (!user) return false;
  const username = normalizeIdentity(user.username);
  const email = normalizeIdentity(user.email);

  return (
    (adminIdentity.username && username === adminIdentity.username) ||
    (adminIdentity.email && email === adminIdentity.email)
  );
}

function resolveUniqueUsername(base) {
  const cleanBase = base.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 30) || "user";
  let candidate = cleanBase;
  let suffix = 1;

  while (findUserByUsername(candidate)) {
    suffix += 1;
    candidate = `${cleanBase}${suffix}`.slice(0, 30);
  }

  return candidate;
}

app.get("/api/health", (_req, res) => {
  return res.json({ ok: true, now: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  const password = String(req.body.password || "");

  if (!identifier || !password) {
    return res.status(400).json({ error: "Utilizador/email e password são obrigatórios." });
  }

  const user = findUserByIdentifier(identifier);

  if (!user) {
    return res.status(401).json({ error: authFailureMessage });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: authFailureMessage });
  }

  const token = signUserToken(user);
  setAuthCookie(res, token);

  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: isAdminUser(user)
    }
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({
    user: {
      ...req.user,
      isAdmin: isAdminUser(req.user)
    }
  });
});

app.post("/api/users", requireAuth, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  let username = normalizeUsername(req.body.username);

  if (!email || !password) {
    return res.status(400).json({ error: "Email e password são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Email inválido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "A password deve ter pelo menos 6 caracteres." });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "Já existe utilizador com esse email." });
  }

  if (!username) {
    username = email.split("@")[0];
  }
  username = resolveUniqueUsername(username);

  const hash = await bcrypt.hash(password, 12);
  const user = insertUser({ username, email, passwordHash: hash });

  return res.status(201).json({
    user: {
      id: user.id,
      username,
      email
    }
  });
});

app.post("/api/users/change-password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "Preenche todos os campos da password." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova password deve ter pelo menos 6 caracteres." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "A nova password e a confirmação não coincidem." });
  }

  const dbUser = findUserById(req.user.id);
  if (!dbUser) {
    return res.status(404).json({ error: "Utilizador não encontrado." });
  }

  const currentMatches = await bcrypt.compare(currentPassword, dbUser.password_hash);
  if (!currentMatches) {
    return res.status(401).json({ error: authFailureMessage });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  const updated = updateUserPassword(req.user.id, hash);
  if (!updated) {
    return res.status(500).json({ error: "Não foi possível atualizar a password." });
  }

  return res.json({ ok: true });
});

app.get("/api/users", requireAuth, (_req, res) => {
  const users = listUsers().map((user) => ({
    ...user,
    isAdmin: isAdminUser(user)
  }));
  return res.json({ users });
});

app.delete("/api/users/:id", requireAuth, (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: "Apenas a conta admin pode apagar utilizadores." });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID de utilizador inválido." });
  }

  if (req.user.id === id) {
    return res.status(400).json({ error: "Não podes apagar a tua própria conta." });
  }

  const targetUser = listUsers().find((u) => u.id === id);
  if (targetUser && isAdminUser(targetUser)) {
    return res.status(400).json({ error: "A conta admin não pode ser apagada." });
  }

  const deleted = deleteUser(id);
  if (!deleted) {
    return res.status(404).json({ error: "Utilizador não encontrado." });
  }
  return res.json({ ok: true });
});

app.get("/api/dashboard", requireAuth, async (_req, res) => {
  const result = await getAnalyticsData({ forceRefresh: false });
  return res.json(result);
});

app.post("/api/dashboard/sync", requireAuth, async (_req, res) => {
  const result = await getAnalyticsData({ forceRefresh: true });
  return res.json(result);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  return res.status(500).json({ error: "Erro interno no servidor." });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor ativo em http://localhost:${PORT}`);
  startScheduler();
});
