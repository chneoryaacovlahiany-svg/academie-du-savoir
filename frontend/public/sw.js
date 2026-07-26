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
  event.respondWith(fetch(event.request));
});
