// Service worker minimal: pas de mise en cache des donnees (pointages, paie...)
// pour ne jamais afficher d'informations perimees - juste la presence d'un
// service worker actif, necessaire pour que le navigateur propose
// "Installer l'application" sur telephone (Android notamment).
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pour la navigation (chargement de la page elle-meme), on force une
  // verification reseau plutot que de laisser le cache HTTP du navigateur
  // reservir une ancienne version qui referencerait des fichiers JS/CSS
  // supprimes lors d'un deploiement plus recent.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  event.respondWith(fetch(event.request));
});

// Recu meme si l'application n'est pas ouverte (le but du push): affiche une
// notification systeme avec eventuellement des boutons d'action (report de
// rappel de sortie).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {};
  }
  const options = {
    body: data.corps,
    tag: data.tag,
    data: { type: data.type, employeeId: data.employeeId },
    actions: data.actions || [],
    requireInteraction: true,
  };
  event.waitUntil(self.registration.showNotification(data.titre || 'Pointeuse', options));
});

// Clic sur la notification elle-meme -> ouvre/focus l'application.
// Clic sur un bouton "+20/30/40 min" -> reporte le rappel sans ouvrir l'app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  if (action && action.startsWith('report_')) {
    const minutes = action.replace('report_', '');
    const { type } = event.notification.data || {};
    event.waitUntil(
      fetch('/api/push/reporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, minutes }),
      })
    );
    return;
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      if (clientsArr.length > 0) return clientsArr[0].focus();
      return self.clients.openWindow('/');
    })
  );
});
