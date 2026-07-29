const BASE_URL = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Authentification
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  changerMotDePasse: (mot_de_passe_actuel, nouveau_mot_de_passe) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify({ mot_de_passe_actuel, nouveau_mot_de_passe }) }),

  // Comptes (admin)
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Employes
  getEmployees: () => request('/employees'),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  // Pointages
  getPointages: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/pointages${qs ? `?${qs}` : ''}`);
  },
  getStatutDuJour: (employeeId) => request(`/pointages/statut/${employeeId}`),
  pointerEntree: (employee_id, lieu) => request('/pointages/entree', { method: 'POST', body: JSON.stringify({ employee_id, lieu }) }),
  pointerSortie: (employee_id) => request('/pointages/sortie', { method: 'POST', body: JSON.stringify({ employee_id }) }),
  updatePointage: (id, data) => request(`/pointages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePointage: (id) => request(`/pointages/${id}`, { method: 'DELETE' }),
  pointageManuel: (data) => request('/pointages/manuel', { method: 'POST', body: JSON.stringify(data) }),

  // Conges
  getConges: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/conges${qs ? `?${qs}` : ''}`);
  },
  createConge: (data) => request('/conges', { method: 'POST', body: JSON.stringify(data) }),
  updateStatutConge: (id, statut) => request(`/conges/${id}/statut`, { method: 'PUT', body: JSON.stringify({ statut }) }),
  deleteConge: (id) => request(`/conges/${id}`, { method: 'DELETE' }),

  // Rapport
  getRapport: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/rapport${qs ? `?${qs}` : ''}`);
  },

  // Parametres
  getParametres: () => request('/parametres'),
  updateParametres: (data) => request('/parametres', { method: 'PUT', body: JSON.stringify(data) }),

  // Bareme des conges par anciennete
  getBareme: () => request('/bareme'),
  updateBareme: (lignes) => request('/bareme', { method: 'PUT', body: JSON.stringify({ lignes }) }),

  // Jours feries
  getFeries: (annee) => request(`/feries${annee ? `?annee=${annee}` : ''}`),
  createFerie: (data) => request('/feries', { method: 'POST', body: JSON.stringify(data) }),
  deleteFerie: (id) => request(`/feries/${id}`, { method: 'DELETE' }),

  // Tableau de bord
  getDashboard: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/dashboard${qs ? `?${qs}` : ''}`);
  },

  // Horaires de travail (par employe)
  getHoraires: (employee_id) => request(`/horaires?employee_id=${employee_id}`),
  updateHoraires: (employee_id, lignes) =>
    request('/horaires', { method: 'PUT', body: JSON.stringify({ employee_id, lignes }) }),

  // Informations de l'entreprise (nom, coordonnees, logo)
  getEntreprise: () => request('/entreprise'),
  updateEntreprise: (data) => request('/entreprise', { method: 'PUT', body: JSON.stringify(data) }),

  // Notifications push (rappels de pointage, meme app fermee)
  getClePubliquePush: () => request('/push/cle-publique'),
  enregistrerAbonnementPush: (subscription, employee_id) =>
    request('/push/abonnement', { method: 'POST', body: JSON.stringify({ ...subscription.toJSON(), employee_id }) }),
  supprimerAbonnementPush: (endpoint) => request('/push/abonnement', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),

  // Historique des avertissements automatiques pour retards
  getAvertissements: () => request('/avertissements'),
  envoyerAvertissement: (employee_id, niveau, message) =>
    request('/avertissements/envoyer', { method: 'POST', body: JSON.stringify({ employee_id, niveau, message }) }),

  // Centre de notifications (historique de tout ce qui a ete envoye par push/email)
  getNotifications: () => request('/notifications'),
  marquerNotificationsLues: () => request('/notifications/tout-marquer-lu', { method: 'POST' }),
  enregistrerNotificationLocale: (type, titre, corps) =>
    request('/notifications', { method: 'POST', body: JSON.stringify({ type, titre, corps }) }),
};
