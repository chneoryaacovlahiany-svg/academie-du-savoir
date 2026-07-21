// Date locale au format YYYY-MM-DD (jamais .toISOString(), qui decale d'un jour
// pour les fuseaux devant UTC comme Israel pendant les premieres heures locales).
export function dateLocale(date = new Date()) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

export function moisLocal(date = new Date()) {
  return dateLocale(date).slice(0, 7);
}
