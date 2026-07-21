import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';

const SEMAINES_PAR_MOIS = 52 / 12;

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
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
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet employe et tout son historique ?')) return;
    await api.deleteEmployee(id);
    charger();
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
              <td>{emp.actif ? 'Actif' : 'Inactif'}</td>
              <td className="actions">
                <button onClick={() => handleEdit(emp)}>Modifier</button>
                <button className="danger" onClick={() => handleDelete(emp.id)}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr>
              <td colSpan={10} className="vide">
                Aucun employe pour le moment
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
