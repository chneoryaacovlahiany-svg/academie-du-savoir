import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useLangue } from '../LangueContext.jsx';

// Le build "legacy" (plutot que le build par defaut, plus recent) est
// necessaire pour rester compatible avec les navigateurs mobiles plus
// anciens (Chrome Android notamment).
GlobalWorkerOptions.workerSrc = workerUrl;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_PAS = 0.25;

// Rendu du PDF page par page sur des <canvas>, plutot qu'un <iframe>/lien
// direct: sur mobile (Chrome Android notamment), un iframe pointant vers un
// PDF n'affiche qu'un bouton "Ouvrir" qui delegue au lecteur PDF du systeme,
// hors de l'application (et hors de la PWA installee), sans moyen d'y
// revenir. En rendant nous-memes les pages, tout reste dans la fenetre
// modale de l'appli.
//
// Rendu a la densite de pixels reelle de l'ecran (devicePixelRatio), sinon
// le texte des documents denses (ex: fiches de paie avec beaucoup de
// petites colonnes) apparait flou et illisible sur les ecrans mobiles a
// haute densite. Le zoom +/- permet en plus d'agrandir au-dela de la
// largeur de l'ecran (avec defilement) pour les documents tres charges.
export default function VisualiseurPdf({ url }) {
  const { t } = useLangue();
  const pagesRef = useRef(null);
  const pdfRef = useRef(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [zoom, setZoom] = useState(1);

  const dessinerPages = async (pdf) => {
    const conteneur = pagesRef.current;
    if (!conteneur) return;
    conteneur.innerHTML = '';
    const dpr = window.devicePixelRatio || 1;

    for (let numeroPage = 1; numeroPage <= pdf.numPages; numeroPage += 1) {
      const page = await pdf.getPage(numeroPage);
      const largeurConteneur = conteneur.clientWidth || 800;
      const echelleBase = largeurConteneur / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: echelleBase * zoom });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.className = 'visualiseur-pdf-page';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      await page.render({ canvasContext: ctx, viewport }).promise;
      conteneur.appendChild(canvas);
    }
  };

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur('');
    setZoom(1);

    (async () => {
      try {
        const reponse = await fetch(url, { credentials: 'same-origin' });
        if (!reponse.ok) throw new Error(t('fichesPaie.erreurChargementPdf'));
        const donnees = await reponse.arrayBuffer();
        if (annule) return;

        const pdf = await getDocument({ data: donnees }).promise;
        if (annule) return;
        pdfRef.current = pdf;
        await dessinerPages(pdf);
        if (!annule) setChargement(false);
      } catch (err) {
        if (!annule) {
          setErreur(err.message || t('fichesPaie.erreurChargementPdf'));
          setChargement(false);
        }
      }
    })();

    return () => {
      annule = true;
    };
  }, [url]);

  useEffect(() => {
    if (!chargement && pdfRef.current) dessinerPages(pdfRef.current);
  }, [zoom]);

  const zoomerAvant = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_PAS));
  const zoomerArriere = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_PAS));

  return (
    <div className="visualiseur-pdf">
      {!chargement && !erreur && (
        <div className="visualiseur-pdf-zoom">
          <button type="button" className="secondary" onClick={zoomerArriere} disabled={zoom <= ZOOM_MIN}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" className="secondary" onClick={zoomerAvant} disabled={zoom >= ZOOM_MAX}>
            +
          </button>
        </div>
      )}
      {chargement && <p className="visualiseur-pdf-chargement">{t('fichesPaie.chargementPdf')}</p>}
      {erreur && <p className="erreur">{erreur}</p>}
      <div ref={pagesRef} className="visualiseur-pdf-pages" />
    </div>
  );
}
