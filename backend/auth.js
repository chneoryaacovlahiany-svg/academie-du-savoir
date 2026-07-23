const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE_NAME = 'session';
const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Cle de signature des sessions: generee une fois et conservee sur disque
// (a cote de la base de donnees), pour que les sessions survivent aux
// redemarrages du serveur sans ajouter de dependance externe (pas de JWT).
function cheminSecret() {
  return path.join(__dirname, 'data', 'session-secret.txt');
}

function chargerSecret() {
  const chemin = cheminSecret();
  if (fs.existsSync(chemin)) {
    return fs.readFileSync(chemin, 'utf8').trim();
  }
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(chemin, secret, { mode: 0o600 });
  return secret;
}

const SECRET = chargerSecret();

function signerToken(payload) {
  const donnees = JSON.stringify({ ...payload, exp: Date.now() + DUREE_SESSION_MS });
  const corps = Buffer.from(donnees).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(corps).digest('base64url');
  return `${corps}.${signature}`;
}

function verifierToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [corps, signature] = token.split('.');
  const attendue = crypto.createHmac('sha256', SECRET).update(corps).digest('base64url');
  const sigBuffer = Buffer.from(signature);
  const attendueBuffer = Buffer.from(attendue);
  if (sigBuffer.length !== attendueBuffer.length || !crypto.timingSafeEqual(sigBuffer, attendueBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(corps, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const entete = req.headers.cookie;
  const cookies = {};
  if (!entete) return cookies;
  for (const partie of entete.split(';')) {
    const idx = partie.indexOf('=');
    if (idx === -1) continue;
    const cle = partie.slice(0, idx).trim();
    const valeur = partie.slice(idx + 1).trim();
    cookies[cle] = decodeURIComponent(valeur);
  }
  return cookies;
}

// Secure absent en local (http); a ajouter si l'app est un jour servie en https.
function definirCookieSession(res, token) {
  const maxAgeSecondes = Math.floor(DUREE_SESSION_MS / 1000);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAgeSecondes}; SameSite=Lax`);
}

function effacerCookieSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

module.exports = {
  COOKIE_NAME,
  signerToken,
  verifierToken,
  parseCookies,
  definirCookieSession,
  effacerCookieSession,
};
