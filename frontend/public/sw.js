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
