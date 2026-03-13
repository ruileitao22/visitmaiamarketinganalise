const jwt = require("jsonwebtoken");

const TOKEN_TTL = "12h";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não definido no ambiente.");
  }
  return secret;
}

function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function verifyUserToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  signUserToken,
  verifyUserToken
};
