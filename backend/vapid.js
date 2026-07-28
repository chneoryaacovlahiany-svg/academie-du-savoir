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

// Le "sub" doit etre une adresse ou une URL correspondant a un vrai domaine:
// Apple (web.push.apple.com, utilise par les iPhone) rejette silencieusement
// les envois avec une erreur 403 "BadJwtToken" si le domaine ressemble a un
// domaine local/factice (ex: .local, .localhost) - contrairement a Google/FCM
// qui ne verifie pas cette valeur, ce qui masquait completement le probleme
// sur Android tout en cassant les notifications sur iPhone.
const vapidKeys = chargerOuGenererVapid();
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:notifications@chronopointe.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

module.exports = { vapidKeys, webpush };
