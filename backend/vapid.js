const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

// Cles VAPID persistees sur disque (DATA_DIR, comme le secret de session):
// elles doivent rester stables entre redemarrages, sinon tous les
// abonnements push existants (crees avec l'ancienne cle publique) deviennent
// invalides.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const cheminVapid = path.join(dataDir, 'vapid.json');

function chargerOuGenererVapid() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(cheminVapid)) {
    return JSON.parse(fs.readFileSync(cheminVapid, 'utf8'));
  }
  const cles = webpush.generateVAPIDKeys();
  fs.writeFileSync(cheminVapid, JSON.stringify(cles));
  return cles;
}

const vapidKeys = chargerOuGenererVapid();
webpush.setVapidDetails('mailto:contact@pointeuse.local', vapidKeys.publicKey, vapidKeys.privateKey);

module.exports = { vapidKeys, webpush };
