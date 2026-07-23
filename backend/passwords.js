const crypto = require('crypto');

// Hachage de mot de passe avec scrypt (module natif de Node, pas de dependance externe).
function hashPassword(password) {
  const sel = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), sel, 64).toString('hex');
  return `${sel}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [sel, hash] = stored.split(':');
  const hashBuffer = Buffer.from(hash, 'hex');
  const suppliedBuffer = crypto.scryptSync(String(password), sel, 64);
  if (hashBuffer.length !== suppliedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, suppliedBuffer);
}

module.exports = { hashPassword, verifyPassword };
