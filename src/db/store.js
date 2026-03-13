const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

function resolveStorePath() {
  const configured = process.env.STORE_PATH || process.env.DB_PATH || "./dashboard-store.json";
  const absolute = path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);

  if (absolute.toLowerCase().endsWith(".db")) {
    return `${absolute}.json`;
  }

  return absolute;
}

const storePath = resolveStorePath();

function defaultState() {
  return {
    users: [],
    analytics_cache: null,
    seq: {
      user: 1
    }
  };
}

function loadState() {
  if (!fs.existsSync(storePath)) {
    const state = defaultState();
    saveState(state);
    return state;
  }

  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      analytics_cache: parsed.analytics_cache || null,
      seq: {
        user: Number(parsed.seq && parsed.seq.user ? parsed.seq.user : 1)
      }
    };
  } catch (_) {
    const state = defaultState();
    saveState(state);
    return state;
  }
}

function saveState(state) {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(storePath, JSON.stringify(state, null, 2), "utf8");
}

let state = loadState();

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function seedInitialUser() {
  const username = process.env.INITIAL_ADMIN_USER || "rleitao";
  const password = process.env.INITIAL_ADMIN_PASSWORD || "visitmaia";
  const email = process.env.INITIAL_ADMIN_EMAIL || "rleitao@visitmaia.local";

  const exists = state.users.find(
    (u) => normalize(u.username) === normalize(username) || normalize(u.email) === normalize(email)
  );

  if (exists) return;

  const user = {
    id: state.seq.user,
    username,
    email,
    password_hash: bcrypt.hashSync(password, 12),
    created_at: new Date().toISOString()
  };

  state.seq.user += 1;
  state.users.push(user);
  saveState(state);

  console.log(`Seed inicial criado: ${username} / ${password}`);
}

seedInitialUser();

function findUserByIdentifier(identifier) {
  const id = normalize(identifier);
  return (
    state.users.find(
      (u) => normalize(u.username) === id || normalize(u.email) === id
    ) || null
  );
}

function findUserByEmail(email) {
  const target = normalize(email);
  return state.users.find((u) => normalize(u.email) === target) || null;
}

function findUserByUsername(username) {
  const target = normalize(username);
  return state.users.find((u) => normalize(u.username) === target) || null;
}

function findUserById(id) {
  const targetId = Number(id);
  return state.users.find((u) => u.id === targetId) || null;
}

function insertUser({ username, email, passwordHash }) {
  const user = {
    id: state.seq.user,
    username,
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };

  state.seq.user += 1;
  state.users.push(user);
  saveState(state);

  return user;
}

function deleteUser(id) {
  const index = state.users.findIndex((u) => u.id === Number(id));
  if (index === -1) return false;
  state.users.splice(index, 1);
  saveState(state);
  return true;
}

function updateUserPassword(id, passwordHash) {
  const index = state.users.findIndex((u) => u.id === Number(id));
  if (index === -1) return false;

  state.users[index].password_hash = passwordHash;
  saveState(state);
  return true;
}

function listUsers() {
  return [...state.users]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      created_at: u.created_at
    }));
}

function getAnalyticsCache() {
  return state.analytics_cache || null;
}

function setAnalyticsCache({ payload, source, fetchedAt }) {
  state.analytics_cache = {
    payload,
    source,
    fetched_at: fetchedAt
  };
  saveState(state);
}

module.exports = {
  findUserByIdentifier,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  insertUser,
  listUsers,
  deleteUser,
  updateUserPassword,
  getAnalyticsCache,
  setAnalyticsCache,
  getStorePath: () => storePath
};
