import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';
import { dateLocale as aujourdhui } from '../dateUtils';

const SEMAINES_PAR_MOIS = 52 / 12;

const JOURS_SEMAINE_NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function horaireParDefaut(jourSemaine) {
  const jourOuvre = jourSemaine <= 4; // Lundi a Vendredi par defaut
  return { jour_semaine: jourSemaine, heure_debut: '09:00', heure_fin: '17:00', actif: jourOuvre, pause_appliquee: true };
}

const EMPLOYE_VIDE = {
  nom: '',
  prenom: '',
  poste: '',
  type_paie: 'horaire',
  taux_horaire: '',
  salaire_mensuel: '',
  heures_semaine: '35',
  solde_conges: '0',
  date_embauche: aujourdhui(),
  pause_minutes: '0',
  droit_heures_sup: 'oui',
};

function tauxHoraireCalcule(form) {
  const heuresMensuelles = Number(form.heures_semaine) * SEMAINES_PAR_MOIS;
  if (!heuresMensuelles) return 0;
  return Number(form.salaire_mensuel) / heuresMensuelles;
}

export default function Employees() {
  const { formatMontant } = useDevise();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPLOYE_VIDE);
  const [editingId, setEditingId] = useState(null);
  const [erreur, setErreur] = useState('');

  const [horaireEmployeeId, setHoraireEmployeeId] = useState(null);
  const [horaireLignes, setHoraireLignes] = useState([]);
  const [messageHoraire, setMessageHoraire] = useState('');

  const charger = () => api.getEmployees().then(setEmployees).catch((e) => setErreur(e.message));

  useEffect(() => {
    charger();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');
    try {
      const payload = {
        nom: form.nom,
        prenom: form.prenom,
        poste: form.poste,
        type_paie: form.type_paie,
        solde_conges: Number(form.solde_conges),
        date_embauche: form.date_embauche,
        pause_minutes: Number(form.pause_minutes) || 0,
        droit_heures_sup: form.droit_heures_sup === 'oui',
        ...(form.type_paie === 'mensuel'
          ? { salaire_mensuel: Number(form.salaire_mensuel), heures_semaine: Number(form.heures_semaine) }
          : { taux_horaire: Number(form.taux_horaire) }),
      };
      if (editingId) {
        await api.updateEmployee(editingId, payload);
      } else {
        await api.createEmployee(payload);
      }
      setForm(EMPLOYE_VIDE);
      setEditingId(null);
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const handleEdit = (emp) => {
    setEditingId(emp.id);
    setForm({
      nom: emp.nom,
      prenom: emp.prenom,
      poste: emp.poste || '',
      type_paie: emp.type_paie || 'horaire',
      taux_horaire: String(emp.taux_horaire),
      salaire_mensuel: emp.salaire_mensuel != null ? String(emp.salaire_mensuel) : '',
      heures_semaine: emp.heures_semaine != null ? String(emp.heures_semaine) : '35',
      solde_conges: String(emp.solde_conges),
      date_embauche: emp.date_embauche || aujourdhui(),
      pause_minutes: String(emp.pause_minutes ?? 0),
      droit_heures_sup: emp.droit_heures_sup ? 'oui' : 'non',
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet employe et tout son historique ?')) return;
    await api.deleteEmployee(id);
    charger();
  };

  const ouvrirHoraires = async (emp) => {
    setErreur('');
    setMessageHoraire('');
    setHoraireEmployeeId(emp.id);
    const existants = await api.getHoraires(emp.id);
    const parJour = Object.fromEntries(existants.map((h) => [h.jour_semaine, h]));
    const lignes = [];
    for (let jour = 0; jour <= 6; jour++) {
      const existant = parJour[jour];
      lignes.push(
        existant
          ? {
              jour_semaine: jour,
              heure_debut: existant.heure_debut || '09:00',
              heure_fin: existant.heure_fin || '17:00',
              actif: !!existant.actif,
              pause_appliquee: existant.pause_appliquee === undefined ? true : !!existant.pause_appliquee,
            }
          : horaireParDefaut(jour)
      );
    }
    setHoraireLignes(lignes);
  };

  const modifierLigneHoraire = (jour, champ, valeur) => {
    setHoraireLignes((lignes) =>
      lignes.map((l) => (l.jour_semaine === jour ? { ...l, [champ]: valeur } : l))
    );
  };

  const enregistrerHoraires = async () => {
    setErreur('');
    setMessageHoraire('');
    try {
      await api.updateHoraires(horaireEmployeeId, horaireLignes);
      setMessageHoraire('Plage horaire enregistree.');
    } catch (err) {
      setErreur(err.message);
    }
  };

  return (
    <div className="panel">
      <h2>Employes</h2>

      <form className="form-inline" onSubmit={handleSubmit}>
        <input name="nom" placeholder="Nom" value={form.nom} onChange={handleChange} required />
        <input name="prenom" placeholder="Prenom" value={form.prenom} onChange={handleChange} required />
        <input name="poste" placeholder="Poste" value={form.poste} onChange={handleChange} />
        <label className="champ-date-embauche">
          Date d'embauche
          <input
            name="date_embauche"
            type="date"
            value={form.date_embauche}
            onChange={handleChange}
            required
          />
        </label>

        <select name="type_paie" value={form.type_paie} onChange={handleChange}>
          <option value="horaire">Taux horaire</option>
          <option value="mensuel">Salaire mensuel fixe</option>
        </select>

        {form.type_paie === 'horaire' ? (
          <input
            name="taux_horaire"
            type="number"
            step="0.01"
            min="0"
            placeholder="Taux horaire"
            value={form.taux_horaire}
            onChange={handleChange}
            required
          />
        ) : (
          <>
            <input
              name="salaire_mensuel"
              type="number"
              step="0.01"
              min="0"
              placeholder="Salaire mensuel fixe"
              value={form.salaire_mensuel}
              onChange={handleChange}
              required
            />
            <input
              name="heures_semaine"
              type="number"
              step="0.5"
              min="0"
              placeholder="Heures par semaine"
              value={form.heures_semaine}
              onChange={handleChange}
              required
            />
            <span className="taux-calcule">Taux horaire calcule: {formatMontant(tauxHoraireCalcule(form))}/h</span>
          </>
        )}

        <input
          name="solde_conges"
          type="number"
          step="0.5"
          placeholder="Ajustement solde conges (jours)"
          value={form.solde_conges}
          onChange={handleChange}
        />
        <label className="champ-date-embauche">
          Pause (minutes)
          <input
            name="pause_minutes"
            type="number"
            step="5"
            min="0"
            value={form.pause_minutes}
            onChange={handleChange}
          />
        </label>
        <label className="champ-date-embauche">
          Heures supplementaires
          <select name="droit_heures_sup" value={form.droit_heures_sup} onChange={handleChange}>
            <option value="oui">Autorisees</option>
            <option value="non">Non autorisees</option>
          </select>
        </label>
        <button type="submit">{editingId ? 'Modifier' : 'Ajouter'}</button>
        {editingId && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setEditingId(null);
              setForm(EMPLOYE_VIDE);
            }}
          >
            Annuler
          </button>
        )}
      </form>

      {erreur && <p className="erreur">{erreur}</p>}

      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prenom</th>
            <th>Poste</th>
            <th>Anciennete</th>
            <th>Mode de paie</th>
            <th>Taux horaire</th>
            <th>Solde conges</th>
            <th>Solde maladie</th>
            <th>Pause</th>
            <th>Heures sup</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.nom}</td>
              <td>{emp.prenom}</td>
              <td>{emp.poste}</td>
              <td>{emp.date_embauche || '-'}</td>
              <td>
                {emp.type_paie === 'mensuel'
                  ? `Mensuel fixe (${formatMontant(emp.salaire_mensuel)}, ${emp.heures_semaine}h/sem)`
                  : 'Horaire'}
              </td>
              <td>{formatMontant(emp.taux_horaire)}/h</td>
              <td>{emp.solde_conges_disponible} j</td>
              <td>{emp.solde_maladie_disponible} j</td>
              <td>{emp.pause_minutes || 0} min</td>
              <td>{emp.droit_heures_sup ? 'Autorisees' : 'Non autorisees'}</td>
              <td>{emp.actif ? 'Actif' : 'Inactif'}</td>
              <td className="actions">
                <button onClick={() => handleEdit(emp)}>Modifier</button>
                <button className="secondary" onClick={() => ouvrirHoraires(emp)}>
                  Horaires
                </button>
                <button className="danger" onClick={() => handleDelete(emp.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={12} className="vide">
                Aucun employe pour le moment
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>

      {horaireEmployeeId && (
        <div className="panneau-edition-jour">
          <h4>
            Plage horaire de {(() => {
              const emp = employees.find((e) => e.id === horaireEmployeeId);
              return emp ? `${emp.prenom} ${emp.nom}` : '';
            })()}
          </h4>
          <p className="aide">
            Le droit aux heures supplementaires se regle dans le formulaire de l'employe
            ci-dessus. La case "Pause" deduit la pause (definie ci-dessus en minutes) des heures
            de ce jour-la: decochez-la pour une demi-journee sans pause. Pour les employes au
            salaire mensuel fixe, un ecart entre ces heures et les heures reellement payees
            (retard, depart anticipe) sera deduit du salaire dans le Rapport & Paie.
          </p>
          {messageHoraire && <p className="confirmation">{messageHoraire}</p>}
          <table>
            <thead>
              <tr>
                <th>Jour</th>
                <th>Travaille</th>
                <th>Heure debut</th>
                <th>Heure fin</th>
                <th>Pause</th>
              </tr>
            </thead>
            <tbody>
              {horaireLignes.map((ligne) => (
                <tr key={ligne.jour_semaine}>
                  <td>{JOURS_SEMAINE_NOMS[ligne.jour_semaine]}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={ligne.actif}
                      onChange={(e) => modifierLigneHoraire(ligne.jour_semaine, 'actif', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={ligne.heure_debut}
                      disabled={!ligne.actif}
                      onChange={(e) => modifierLigneHoraire(ligne.jour_semaine, 'heure_debut', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={ligne.heure_fin}
                      disabled={!ligne.actif}
                      onChange={(e) => modifierLigneHoraire(ligne.jour_semaine, 'heure_fin', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={ligne.pause_appliquee}
                      disabled={!ligne.actif}
                      onChange={(e) => modifierLigneHoraire(ligne.jour_semaine, 'pause_appliquee', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-inline">
            <button onClick={enregistrerHoraires}>Enregistrer</button>
            <button className="secondary" onClick={() => setHoraireEmployeeId(null)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
