import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import {
  permissionNotifications,
  demanderPermissionNotifications,
  envoyerNotificationUneFois,
} from '../notifications';

// Lundi = 0 ... Dimanche = 6 (coherent avec le reste de l'app).
function jourSemaineLundi0(date) {
  return (date.getDay() + 6) % 7;
}

function minutesDepuisMinuit(heureStr) {
  const [h, m] = heureStr.split(':').map(Number);
  return h * 60 + m;
}

// Determine si un rappel de pointage est necessaire pour un employe, a partir
// de sa plage horaire du jour (si definie) ou d'une plage generique par
// defaut (9h-19h) sinon. Aucun rappel si le jour est un jour de repos prevu.
function calculerRappel(horaires, statut, maintenant) {
  const jourIdx = jourSemaineLundi0(maintenant);
  const minutesActuelles = maintenant.getHours() * 60 + maintenant.getMinutes();
  const horaireJour = (horaires || []).find((h) => h.jour_semaine === jourIdx);

  if ((horaires || []).length > 0 && (!horaireJour || !horaireJour.actif)) {
    return null;
  }

  const heureDebut = horaireJour?.heure_debut ? minutesDepuisMinuit(horaireJour.heure_debut) : 9 * 60;
  const heureFin = horaireJour?.heure_fin ? minutesDepuisMinuit(horaireJour.heure_fin) : 19 * 60;

  const pointe = statut && statut.heure_entree && !statut.heure_sortie;
  const termine = statut && statut.heure_entree && statut.heure_sortie;

  if (!termine && !pointe && minutesActuelles >= heureDebut) return 'entree';
  if (pointe && minutesActuelles >= heureFin) return 'sortie';
  return null;
}

function formatHeure(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuree(heures) {
  if (heures == null) return '-';
  const h = Math.floor(heures);
  const m = Math.round((heures - h) * 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

function labelLieu(lieu) {
  if (lieu === 'bureau') return 'Bureau';
  if (lieu === 'domicile') return 'Domicile';
  return null;
}

export default function Pointage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [statuts, setStatuts] = useState({});
  const [horaires, setHoraires] = useState({});
  const [lieux, setLieux] = useState({});
  const [erreur, setErreur] = useState('');
  const [maintenant, setMaintenant] = useState(new Date());
  const [permission, setPermission] = useState(permissionNotifications());

  const charger = async () => {
    const emps = await api.getEmployees();
    const actifs = emps.filter((e) => e.actif);
    setEmployees(actifs);
    const entries = await Promise.all(actifs.map(async (e) => [e.id, await api.getStatutDuJour(e.id)]));
    setStatuts(Object.fromEntries(entries));
    const horairesEntries = await Promise.all(actifs.map(async (e) => [e.id, await api.getHoraires(e.id)]));
    setHoraires(Object.fromEntries(horairesEntries));
  };

  useEffect(() => {
    charger();
  }, []);

  // Reverifie l'heure toutes les minutes pour que les rappels apparaissent
  // sans avoir a recharger la page.
  useEffect(() => {
    const intervalle = setInterval(() => setMaintenant(new Date()), 60000);
    return () => clearInterval(intervalle);
  }, []);

  // Envoie une vraie notification navigateur uniquement pour l'employe
  // actuellement connecte (jamais pour les cartes des collegues consultees par un admin).
  useEffect(() => {
    if (!user?.employee_id) return;
    const rappel = calculerRappel(horaires[user.employee_id], statuts[user.employee_id], maintenant);
    if (rappel === 'entree') {
      envoyerNotificationUneFois(`entree-${user.employee_id}`, 'Pointeuse', {
        body: "N'oubliez pas de pointer votre entree.",
      });
    } else if (rappel === 'sortie') {
      envoyerNotificationUneFois(`sortie-${user.employee_id}`, 'Pointeuse', {
        body: "N'oubliez pas de pointer votre sortie.",
      });
    }
  }, [user, horaires, statuts, maintenant]);

  const activerNotifications = async () => {
    const resultat = await demanderPermissionNotifications();
    setPermission(resultat);
  };

  const pointer = async (employeeId, action) => {
    setErreur('');
    try {
      if (action === 'entree') await api.pointerEntree(employeeId, lieux[employeeId] || 'bureau');
      else await api.pointerSortie(employeeId);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="panel">
      <h2>Pointage du jour</h2>
      <p className="date-du-jour">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {erreur && <p className="erreur">{erreur}</p>}

      {user?.employee_id && permission === 'default' && (
        <p className="confirmation">
          Active les notifications pour recevoir un rappel si tu oublies de pointer.{' '}
          <button type="button" className="secondary" onClick={activerNotifications}>
            Activer les notifications
          </button>
        </p>
      )}

      <div className="cartes-pointage">
        {employees.map((emp) => {
          const statut = statuts[emp.id];
          const pointe = statut && statut.heure_entree && !statut.heure_sortie;
          const termine = statut && statut.heure_entree && statut.heure_sortie;
          const rappel = calculerRappel(horaires[emp.id], statut, maintenant);

          return (
            <div className="carte-employe" key={emp.id}>
              <div className="carte-nom">
                {emp.prenom} {emp.nom}
              </div>
              <div className="carte-poste">{emp.poste}</div>
              <div className="carte-heures">
                Entree: {formatHeure(statut?.heure_entree)} | Sortie: {formatHeure(statut?.heure_sortie)}
                {labelLieu(statut?.lieu) && ` (${labelLieu(statut.lieu)})`}
              </div>
              {termine && <div className="carte-total">Total: {formatDuree(statut.heures_travaillees)}</div>}
              {rappel === 'entree' && (
                <p className="rappel-pointage">N'oubliez pas de pointer l'entree !</p>
              )}
              {rappel === 'sortie' && (
                <p className="rappel-pointage">N'oubliez pas de pointer la sortie !</p>
              )}
              {!pointe && !termine && (
                <label className="champ-date-embauche">
                  Lieu de pointage
                  <select
                    value={lieux[emp.id] || 'bureau'}
                    onChange={(e) => setLieux({ ...lieux, [emp.id]: e.target.value })}
                  >
                    <option value="bureau">Bureau</option>
                    <option value="domicile">Domicile</option>
                  </select>
                </label>
              )}
              <div className="carte-actions">
                <button
                  className="entree"
                  disabled={pointe || termine}
                  onClick={() => pointer(emp.id, 'entree')}
                >
                  Entree
                </button>
                <button
                  className="sortie"
                  disabled={!pointe}
                  onClick={() => pointer(emp.id, 'sortie')}
                >
                  Sortie
                </button>
              </div>
            </div>
          );
        })}
        {employees.length === 0 && <p className="vide">Aucun employe actif. Ajoutez des employes dans l'onglet correspondant.</p>}
      </div>
    </div>
  );
}
