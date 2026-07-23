import { dateLocale } from './dateUtils';

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
export function envoyerNotificationUneFois(cle, titre, options) {
  if (!notificationsSupportees() || Notification.permission !== 'granted') return;
  const cleStockage = CLE_PREFIX + cle;
  const aujourdhui = dateLocale();
  if (localStorage.getItem(cleStockage) === aujourdhui) return;
  new Notification(titre, options);
  localStorage.setItem(cleStockage, aujourdhui);
}
