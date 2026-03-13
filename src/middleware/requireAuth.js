const { verifyUserToken } = require("../services/authService");

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  try {
    const payload = verifyUserToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email
    };
    return next();
  } catch (_) {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

module.exports = { requireAuth };
