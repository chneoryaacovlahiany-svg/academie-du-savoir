import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDevise } from '../DeviseContext.jsx';
import { useLangue } from '../LangueContext.jsx';

function formatDateFr(dateStr, locale) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Dashboard() {
  const { formatMontant } = useDevise();
  const { t, locale } = useLangue();
  const [employees, setEmployees] = useState([]);
  const [employeeFiltre, setEmployeeFiltre] = useState('');
  const [donnees, setDonnees] = useState(null);
  const [congesEnAttente, setCongesEnAttente] = useState([]);
  const [erreur, setErreur] = useState('');

  const STATUT_INFO = {
    bon: { label: t('dashboard.statutBon'), icone: '✓', classe: 'statut-bon' },
    excedent: { label: t('dashboard.statutExcedent'), icone: '!', classe: 'statut-excedent' },
    critique: { label: t('dashboard.statutCritique'), icone: '✕', classe: 'statut-critique' },
  };

  const TYPE_LABELS = {
    conge_paye: t('dashboard.typeCongePaye'),
    sans_solde: t('dashboard.typeSansSolde'),
    maladie: t('dashboard.typeMaladie'),
    autre: t('dashboard.typeAutre'),
  };

  const charger = async (employeeId) => {
    setErreur('');
    try {
      setDonnees(await api.getDashboard(employeeId ? { employee_id: employeeId } : {}));
    } catch (err) {
      setErreur(err.message);
    }
  };

  const chargerCongesEnAttente = async () => {
    try {
      setCongesEnAttente(await api.getConges({ statut: 'en_attente' }));
    } catch {
      setCongesEnAttente([]);
    }
  };

  useEffect(() => {
    api.getEmployees().then(setEmployees);
    chargerCongesEnAttente();
  }, []);

  useEffect(() => {
    charger(employeeFiltre);
  }, [employeeFiltre]);

  const nomEmploye = (id) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.prenom} ${e.nom}` : `#${id}`;
  };

  const traiterConge = async (id, statut) => {
    await api.updateStatutConge(id, statut);
    chargerCongesEnAttente();
    charger(employeeFiltre);
  };

  if (erreur) return <div className="panel"><p className="erreur">{erreur}</p></div>;
  if (!donnees) return <div className="panel">{t('common.loading')}</div>;

  const { global: g, employes } = donnees;

  return (
    <div className="panel">
      <h2>{t('dashboard.title')}</h2>

      <div className="form-inline">
        <label>
          {t('dashboard.employeLabel')}{' '}
          <select value={employeeFiltre} onChange={(e) => setEmployeeFiltre(e.target.value)}>
            <option value="">{t('common.allEmployees')}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.prenom} {e.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cadrans">
        <div className="cadran">
          <div className="cadran-valeur">{g.jours_conges_pris_annee}</div>
          <div className="cadran-label">{t('dashboard.joursCongesPris', { annee: donnees.periode.annee })}</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{g.jours_conges_restants}</div>
          <div className="cadran-label">
            {t('dashboard.joursCongesRestants')} {employeeFiltre ? '' : t('dashboard.tousEmployesSuffix')}
          </div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_horaire)}</div>
          <div className="cadran-label">{t('dashboard.paieHoraire')}</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_mensuelle)}</div>
          <div className="cadran-label">{t('dashboard.paieFixe')}</div>
        </div>
        <div className="cadran cadran-principal">
          <div className="cadran-valeur">{formatMontant(g.masse_salariale_totale)}</div>
          <div className="cadran-label">{t('dashboard.totalAPayer')}</div>
        </div>
        <div className="cadran">
          <div className="cadran-valeur cadran-valeur-petite">
            {g.prochain_jour_ferie ? formatDateFr(g.prochain_jour_ferie.date, locale) : t('dashboard.aucun')}
          </div>
          <div className="cadran-label">
            {g.prochain_jour_ferie
              ? t('dashboard.prochainFerie', { nom: g.prochain_jour_ferie.nom })
              : t('dashboard.prochainJourFerie')}
          </div>
        </div>
        <div className={`cadran ${congesEnAttente.length > 0 ? 'cadran-alerte' : ''}`}>
          <div className="cadran-valeur">{congesEnAttente.length}</div>
          <div className="cadran-label">{t('dashboard.demandesCongeAttente')}</div>
        </div>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      {congesEnAttente.length > 0 && (
        <>
          <h3>{t('dashboard.demandesCongeAttenteTitre')}</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('common.employee')}</th>
                  <th>{t('dashboard.colDebut')}</th>
                  <th>{t('dashboard.colFin')}</th>
                  <th>{t('dashboard.colJours')}</th>
                  <th>{t('dashboard.colType')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {congesEnAttente.map((c) => (
                  <tr key={c.id}>
                    <td>{nomEmploye(c.employee_id)}</td>
                    <td>{c.date_debut}</td>
                    <td>{c.date_fin}</td>
                    <td>{c.nb_jours}</td>
                    <td>{TYPE_LABELS[c.type] || c.type}</td>
                    <td className="actions">
                      <button onClick={() => traiterConge(c.id, 'approuve')}>{t('dashboard.approuver')}</button>
                      <button className="secondary" onClick={() => traiterConge(c.id, 'refuse')}>
                        {t('dashboard.refuser')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>{t('dashboard.congesParEmploye')}</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('common.employee')}</th>
              <th>{t('dashboard.droitAnnuelActuel')}</th>
              <th>{t('dashboard.prisCetteAnnee')}</th>
              <th>{t('dashboard.restant')}</th>
              <th>{t('dashboard.soldeMaladie')}</th>
              <th>{t('dashboard.statut')}</th>
            </tr>
          </thead>
          <tbody>
            {employes.map((e) => {
              const info = STATUT_INFO[e.statut] || STATUT_INFO.bon;
              return (
                <tr key={e.employee_id}>
                  <td>
                    {e.prenom} {e.nom}
                  </td>
                  <td>{e.droit_annuel_actuel} {t('dashboard.parAn')}</td>
                  <td>{e.jours_pris_annee} {t('common.joursAbrev')}</td>
                  <td>{e.jours_restants} {t('common.joursAbrev')}</td>
                  <td>{e.solde_maladie_disponible} {t('common.joursAbrev')}</td>
                  <td>
                    <span className={`statut-badge ${info.classe}`}>
                      <span aria-hidden="true">{info.icone}</span> {info.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {employes.length === 0 && (
              <tr>
                <td colSpan={6} className="vide">
                  {t('dashboard.aucunEmployeActif')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
