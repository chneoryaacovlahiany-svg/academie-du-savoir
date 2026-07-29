import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import { useDevise } from '../DeviseContext.jsx';
import { useEntreprise } from '../EntrepriseContext.jsx';
import { useLangue } from '../LangueContext.jsx';
import { moisLocal as moisCourant } from '../dateUtils';
import { exporterCSV, exporterPDF } from '../export';

// Charge pdfjs-dist (bibliotheque volumineuse) uniquement quand on ouvre
// reellement une fiche de paie, plutot que de l'inclure dans le
// chargement initial de toute l'application.
const VisualiseurPdf = lazy(() => import('./VisualiseurPdf.jsx'));

function lireFichierBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.readAsDataURL(fichier);
  });
}

export default function Rapport() {
  const { user } = useAuth();
  const estAdmin = user.role === 'admin';
  const { formatMontant } = useDevise();
  const { entreprise } = useEntreprise();
  const { t, direction, locale } = useLangue();
  const [mois, setMois] = useState(moisCourant());
  const [rapport, setRapport] = useState([]);
  const [erreur, setErreur] = useState('');

  const [fichesPaie, setFichesPaie] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [nouvelleFiche, setNouvelleFiche] = useState({ employee_id: '', mois: moisCourant(), fichier: null });
  const [erreurFiche, setErreurFiche] = useState('');
  const [messageFiche, setMessageFiche] = useState('');
  const [ficheVisualisee, setFicheVisualisee] = useState(null);

  const chargerFichesPaie = () => api.getFichesPaie().then(setFichesPaie);

  useEffect(() => {
    chargerFichesPaie();
    if (estAdmin) api.getEmployees().then((e) => setEmployees(e.filter((emp) => emp.actif)));
  }, []);

  const ajouterFiche = async (e) => {
    e.preventDefault();
    setErreurFiche('');
    setMessageFiche('');
    if (!nouvelleFiche.fichier) {
      setErreurFiche(t('fichesPaie.erreurFichierRequis'));
      return;
    }
    try {
      const contenu_base64 = await lireFichierBase64(nouvelleFiche.fichier);
      await api.uploaderFichePaie({
        employee_id: nouvelleFiche.employee_id,
        mois: nouvelleFiche.mois,
        nom_fichier: nouvelleFiche.fichier.name,
        contenu_base64,
      });
      setNouvelleFiche({ employee_id: '', mois: moisCourant(), fichier: null });
      document.getElementById('fiche-paie-fichier').value = '';
      chargerFichesPaie();
    } catch (err) {
      setErreurFiche(err.message);
    }
  };

  const supprimerFiche = async (id) => {
    if (!window.confirm(t('fichesPaie.confirmSupprimer'))) return;
    await api.supprimerFichePaie(id);
    chargerFichesPaie();
  };

  // Recupere le fichier via fetch (pas une navigation directe vers l'URL):
  // sur Safari iOS, un lien vers un PDF ouvre une page de consultation dans
  // l'onglet en cours au lieu de proposer un telechargement, sans moyen d'y
  // revenir (meme souci que constate avec l'ancien "Visualiser" en iframe).
  // Le clic programmatique sur un lien pointant vers un blob local declenche
  // l'enregistrement sans jamais quitter la page de l'application.
  const telechargerFiche = async (id, nomFichier) => {
    setErreurFiche('');
    try {
      const reponse = await fetch(`/api/fiches-paie/${id}/telecharger`, { credentials: 'same-origin' });
      if (!reponse.ok) throw new Error(t('fichesPaie.erreurChargementPdf'));
      const blob = await reponse.blob();
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = nomFichier;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreurFiche(err.message);
    }
  };

  const charger = async (m) => {
    setErreur('');
    try {
      const data = await api.getRapport({ mois: m });
      setRapport(data);
    } catch (err) {
      setErreur(err.message);
    }
  };

  useEffect(() => {
    if (estAdmin) charger(mois);
  }, [mois]);

  const totalGeneral = rapport.reduce((acc, r) => acc + r.montant_total, 0);
  const totalHeures = rapport.reduce((acc, r) => acc + r.total_heures, 0);

  const entetesExport = [
    t('rapport.colEmploye'),
    t('rapport.colModePaie'),
    t('rapport.colTauxHoraire'),
    t('rapport.colHeuresTravaillees'),
    t('rapport.colCongesPayes'),
    t('rapport.colFeriesPayes'),
    t('rapport.colSoldeConges'),
    t('rapport.colSoldeMaladie'),
    t('rapport.colHeuresManquantes'),
    t('rapport.colMontantTravail'),
    t('rapport.colDeductionHoraire'),
    t('rapport.colMontantConges'),
    t('rapport.colMontantMaladie'),
    t('rapport.colMontantHeuresSup'),
    t('rapport.colMontantFeries'),
    t('rapport.colMontantTotal'),
  ];
  const lignesExport = () =>
    rapport.map((r) => [
      `${r.prenom} ${r.nom}`,
      r.type_paie === 'mensuel' ? t('rapport.mensuelFixe') : t('rapport.horaire'),
      `${formatMontant(r.taux_horaire)}/h`,
      `${r.total_heures.toFixed(2)} h`,
      r.jours_conges_payes,
      r.jours_feries_payes,
      `${r.solde_conges_disponible} ${t('common.joursAbrev')}`,
      `${r.solde_maladie_disponible} ${t('common.joursAbrev')}`,
      r.heures_manquantes > 0 ? `${r.heures_manquantes.toFixed(2)} h` : '-',
      formatMontant(r.montant_travail),
      r.montant_deduction_horaire > 0 ? `-${formatMontant(r.montant_deduction_horaire)}` : '-',
      formatMontant(r.montant_conges),
      formatMontant(r.montant_maladie),
      formatMontant(r.montant_heures_sup),
      formatMontant(r.montant_jours_feries),
      formatMontant(r.montant_total),
    ]);

  const exporterRapportCSV = () => {
    const lignes = [
      ...lignesExport(),
      [t('rapport.total'), '', '', `${totalHeures.toFixed(2)} h`, '', '', '', '', '', '', '', '', '', '', '', formatMontant(totalGeneral)],
    ];
    exporterCSV(`rapport_paie_${mois}`, entetesExport, lignes, { entreprise });
  };

  const exporterRapportPDF = () => {
    const lignes = [
      ...lignesExport(),
      [t('rapport.total'), '', '', `${totalHeures.toFixed(2)} h`, '', '', '', '', '', '', '', '', '', '', '', formatMontant(totalGeneral)],
    ];
    exporterPDF(`rapport_paie_${mois}`, t('rapport.pdfTitre', { mois }), entetesExport, lignes, {
      fontSize: 6,
      entreprise,
      rtl: direction === 'rtl',
    });
  };

  return (
    <div className="panel">
      {estAdmin && (
        <>
          <h2>{t('rapport.title')}</h2>

          <div className="form-inline">
            <label>
              {t('rapport.moisLabel')}{' '}
              <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
            </label>
            <button type="button" className="secondary" onClick={exporterRapportCSV} disabled={rapport.length === 0}>
              {t('rapport.exporterExcel')}
            </button>
            <button type="button" className="secondary" onClick={exporterRapportPDF} disabled={rapport.length === 0}>
              {t('rapport.exporterPDF')}
            </button>
          </div>

          {erreur && <p className="erreur">{erreur}</p>}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('rapport.colEmploye')}</th>
                  <th>{t('rapport.colModePaie')}</th>
                  <th>{t('rapport.colTauxHoraire')}</th>
                  <th>{t('rapport.colHeuresTravaillees')}</th>
                  <th>{t('rapport.colCongesPayes')}</th>
                  <th>{t('rapport.colFeriesPayes')}</th>
                  <th>{t('rapport.colSoldeConges')}</th>
                  <th>{t('rapport.colSoldeMaladie')}</th>
                  <th>{t('rapport.colHeuresManquantes')}</th>
                  <th>{t('rapport.colMontantTravail')}</th>
                  <th>{t('rapport.colDeductionHoraire')}</th>
                  <th>{t('rapport.colMontantConges')}</th>
                  <th>{t('rapport.colMontantMaladie')}</th>
                  <th>{t('rapport.colMontantHeuresSup')}</th>
                  <th>{t('rapport.colMontantFeries')}</th>
                  <th>{t('rapport.colMontantTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {rapport.map((r) => (
                  <tr key={r.employee_id}>
                    <td>
                      {r.prenom} {r.nom}
                    </td>
                    <td>{r.type_paie === 'mensuel' ? t('rapport.mensuelFixe') : t('rapport.horaire')}</td>
                    <td>{formatMontant(r.taux_horaire)}/h</td>
                    <td>{r.total_heures.toFixed(2)} h</td>
                    <td>{r.jours_conges_payes}</td>
                    <td>{r.jours_feries_payes}</td>
                    <td>{r.solde_conges_disponible} {t('common.joursAbrev')}</td>
                    <td>{r.solde_maladie_disponible} {t('common.joursAbrev')}</td>
                    <td>{r.heures_manquantes > 0 ? `${r.heures_manquantes.toFixed(2)} h` : '-'}</td>
                    <td>{formatMontant(r.montant_travail)}</td>
                    <td>{r.montant_deduction_horaire > 0 ? `-${formatMontant(r.montant_deduction_horaire)}` : '-'}</td>
                    <td>{formatMontant(r.montant_conges)}</td>
                    <td>{formatMontant(r.montant_maladie)}</td>
                    <td>{formatMontant(r.montant_heures_sup)}</td>
                    <td>{formatMontant(r.montant_jours_feries)}</td>
                    <td className="montant-total">{formatMontant(r.montant_total)}</td>
                  </tr>
                ))}
                {rapport.length === 0 && (
                  <tr>
                    <td colSpan={16} className="vide">
                      {t('rapport.aucuneDonnee')}
                    </td>
                  </tr>
                )}
              </tbody>
              {rapport.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      <strong>{t('rapport.total')}</strong>
                    </td>
                    <td>
                      <strong>{totalHeures.toFixed(2)} h</strong>
                    </td>
                    <td colSpan={10}></td>
                    <td className="montant-total">
                      <strong>{formatMontant(totalGeneral)}</strong>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      <h2>{estAdmin ? t('fichesPaie.titre') : t('fichesPaie.titreEmploye')}</h2>
      {erreurFiche && <p className="erreur">{erreurFiche}</p>}

      {estAdmin && (
        <>
          <h3>{t('fichesPaie.ajouterTitre')}</h3>
          {messageFiche && <p className="confirmation">{messageFiche}</p>}
          <form className="form-inline" onSubmit={ajouterFiche}>
            <label>
              {t('fichesPaie.employeLabel')}
              <select
                value={nouvelleFiche.employee_id}
                onChange={(e) => setNouvelleFiche({ ...nouvelleFiche, employee_id: e.target.value })}
                required
              >
                <option value="" disabled>
                  {t('fichesPaie.choisirEmploye')}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('fichesPaie.moisLabel')}
              <input
                type="month"
                value={nouvelleFiche.mois}
                onChange={(e) => setNouvelleFiche({ ...nouvelleFiche, mois: e.target.value })}
                required
              />
            </label>
            <label>
              {t('fichesPaie.fichierLabel')}
              <input
                id="fiche-paie-fichier"
                type="file"
                accept="application/pdf"
                onChange={(e) => setNouvelleFiche({ ...nouvelleFiche, fichier: e.target.files[0] || null })}
                required
              />
            </label>
            <button type="submit">{t('fichesPaie.ajouterBouton')}</button>
          </form>
        </>
      )}

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('fichesPaie.colMois')}</th>
              {estAdmin && <th>{t('fichesPaie.colEmploye')}</th>}
              <th>{t('fichesPaie.colFichier')}</th>
              <th>{t('fichesPaie.colDateAjout')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {fichesPaie.map((f) => (
              <tr key={f.id}>
                <td>{f.mois}</td>
                {estAdmin && (
                  <td>
                    {f.prenom} {f.nom}
                  </td>
                )}
                <td>{f.nom_fichier}</td>
                <td>{new Date(f.date_upload.replace(' ', 'T') + 'Z').toLocaleString(locale)}</td>
                <td className="actions">
                  <button type="button" className="bouton-lien" onClick={() => setFicheVisualisee(f.id)}>
                    {t('fichesPaie.visualiser')}
                  </button>
                  <button
                    type="button"
                    className="bouton-lien"
                    onClick={() => telechargerFiche(f.id, f.nom_fichier)}
                  >
                    {t('fichesPaie.telecharger')}
                  </button>
                  {estAdmin && (
                    <button type="button" className="danger" onClick={() => supprimerFiche(f.id)}>
                      {t('common.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {fichesPaie.length === 0 && (
              <tr>
                <td colSpan={estAdmin ? 5 : 4} className="vide">
                  {t('fichesPaie.aucuneFiche')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ficheVisualisee && (
        <div className="modale-fond" onClick={() => setFicheVisualisee(null)}>
          <div className="modale-contenu" onClick={(e) => e.stopPropagation()}>
            <div className="modale-entete">
              <button type="button" className="secondary" onClick={() => setFicheVisualisee(null)}>
                {t('fichesPaie.fermer')}
              </button>
            </div>
            <div className="modale-corps">
              <Suspense fallback={<p className="visualiseur-pdf-chargement">{t('fichesPaie.chargementPdf')}</p>}>
                <VisualiseurPdf url={`/api/fiches-paie/${ficheVisualisee}/visualiser`} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
