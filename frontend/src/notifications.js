import { dateLocale } from './dateUtils';
import { api } from './api';

const CLE_PREFIX = 'pointeuse_notif_';

export function notificationsSupportees() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissionNotifications() {
  return notificationsSupportees() ? Notification.permission : 'non-supporte';
}

export function demanderPermissionNotifications() {
  if (!notificationsSupportees()) return Promise.resolve('non-supporte');
  return Notification.requestPermission();
}

// Envoie une notification navigateur au plus une fois par jour pour une meme
// cle (ex: "entree-12"), pour ne pas spammer l'utilisateur a chaque
// verification periodique.
//
// Chrome Android interdit le constructeur "new Notification(...)" des qu'un
// service worker est actif (obligatoire pour l'app installable sur
// telephone): il faut alors passer par ServiceWorkerRegistration.showNotification().
// On utilise donc le service worker quand il est disponible, et on ne
// retombe sur le constructeur classique que s'il n'y en a pas (ex: pas de
// service worker enregistre).
export async function envoyerNotificationUneFois(cle, titre, options, type) {
  if (!notificationsSupportees() || Notification.permission !== 'granted') return;
  const cleStockage = CLE_PREFIX + cle;
  const aujourdhui = dateLocale();
  if (localStorage.getItem(cleStockage) === aujourdhui) return;

  // Ce rappel s'affiche uniquement cote navigateur (jamais via le serveur),
  // donc sans cet appel il n'apparaitrait jamais dans l'historique de la
  // cloche de notifications, contrairement aux rappels du planificateur.
  const journaliser = () => {
    if (type) api.enregistrerNotificationLocale(type, titre, options.body).catch(() => {});
  };

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(titre, options);
      localStorage.setItem(cleStockage, aujourdhui);
      journaliser();
      return;
    }
  }
  new Notification(titre, options);
  localStorage.setItem(cleStockage, aujourdhui);
  journaliser();
}

export function pushSupporte() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Le navigateur attend la cle VAPID encodee en base64url; PushManager.subscribe
// veut un Uint8Array.
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Standard = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(base64Standard);
  return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

// Abonne cet appareil aux notifications push et enregistre l'abonnement cote
// serveur pour l'employe donne. A appeler apres que l'utilisateur a autorise
// les notifications (les rappels arriveront ensuite meme app fermee).
export async function abonnerAuxPush(employeeId) {
  if (!pushSupporte() || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { cle_publique } = await api.getClePubliquePush();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cle_publique),
    });
  }
  await api.enregistrerAbonnementPush(subscription, employeeId);
  return subscription;
}

export async function desabonnerDesPush() {
  if (!pushSupporte()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api.supprimerAbonnementPush(subscription.endpoint);
  await subscription.unsubscribe();
}
