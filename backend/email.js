const { Resend } = require('resend');

// La cle API Resend est fournie via une variable d'environnement (jamais dans
// le code ni dans le depot): si elle est absente, l'envoi d'email est
// simplement desactive silencieusement (aucune erreur bloquante), pour ne pas
// empecher le reste de l'application de fonctionner tant que ce n'est pas
// configure.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EXPEDITEUR_DEFAUT = 'Pointeuse <notifications@chronopointe.com>';

async function envoyerEmail(destinataire, sujet, corps) {
  if (!resend || !destinataire) return;
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM || EXPEDITEUR_DEFAUT,
      to: destinataire,
      subject: sujet,
      text: corps,
    });
  } catch (err) {
    console.error('Erreur envoi email:', err.message);
  }
}

module.exports = { envoyerEmail };
