const db = require('./db');

// Journalise chaque notification (rappel, avertissement, conge...) envoyee a
// un employe, quel que soit le canal reellement utilise (push, email, les
// deux, ou aucun s'il n'y avait pas d'appareil/adresse) - c'est cette table
// qui alimente l'historique consultable dans l'icone de notifications de
// l'application, independamment du succes de la livraison push/email.
function enregistrerNotification(employeeId, type, titre, corps) {
  db.prepare('INSERT INTO notifications (employee_id, type, titre, corps) VALUES (?, ?, ?, ?)').run(
    employeeId,
    type,
    titre,
    corps
  );
}

module.exports = { enregistrerNotification };
