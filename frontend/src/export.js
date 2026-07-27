import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { DejaVuSansNormal } from './fonts/DejaVuSansNormal';
import { DejaVuSansBold } from './fonts/DejaVuSansBold';

function telechargerBlob(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function lignesEnteteEntreprise(entreprise) {
  if (!entreprise) return [];
  const lignes = [];
  if (entreprise.nom) lignes.push([entreprise.nom]);
  if (entreprise.adresse) lignes.push([entreprise.adresse]);
  const contact = [entreprise.telephone, entreprise.email].filter(Boolean).join(' - ');
  if (contact) lignes.push([contact]);
  return lignes;
}

// Export CSV (s'ouvre directement dans Excel/Sheets). BOM UTF-8 pour que les
// accents francais et l'hebreu s'affichent correctement dans Excel,
// point-virgule comme separateur (convention Excel FR). Excel gere
// nativement le sens de lecture de l'hebreu, aucun traitement particulier
// n'est necessaire ici (contrairement au PDF).
export function exporterCSV(nomFichier, entetes, lignes, options = {}) {
  const echapper = (val) => {
    const s = val == null ? '' : String(val);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const enteteEntreprise = lignesEnteteEntreprise(options.entreprise);
  const blocs = [...enteteEntreprise, ...(enteteEntreprise.length ? [[]] : []), entetes, ...lignes];
  const contenu = blocs.map((ligne) => ligne.map(echapper).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' });
  telechargerBlob(blob, `${nomFichier}.csv`);
}

const HEBREU_RE = /[֐-׿]/;
const MOT_HEBREU_RE = /^[֐-׿"'׳״.,:;()%-]+$/;

// Parentheses/crochets: en ecriture de droite a gauche, leur FORME visuelle
// doit s'inverser (une parenthese ouvrante devient visuellement une
// fermante) pour continuer a "ouvrir" vers le texte qu'elle contient - c'est
// la regle standard du "mirroring" Unicode pour le bidi.
const MIROIR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{' };

// jsPDF ne fait pas de reordonnancement bidi (algorithme Unicode BiDi): le
// texte est toujours dessine caractere par caractere de gauche a droite, ce
// qui rend l'hebreu illisible tel quel. L'hebreu n'ayant pas de liaison
// cursive entre lettres (contrairement a l'arabe), inverser l'ordre des
// caracteres d'un mot hebreu (en inversant aussi les parentheses), puis
// inverser l'ordre des mots, suffit a obtenir un rendu visuellement correct.
// jsPDF a par ailleurs un comportement interne qui reinverse deja tout mot
// ne contenant pas de caracteres hebreux des qu'un caractere hebreu est
// present ailleurs dans la meme chaine (verifie empiriquement): les nombres
// et le texte latin (noms d'employes, dates...) ne doivent donc surtout pas
// etre inverses ici, sous peine d'etre inverses deux fois.
function inverserSiHebreu(valeur) {
  if (valeur == null) return valeur;
  const texte = String(valeur);
  if (!HEBREU_RE.test(texte)) return texte;
  const mots = texte.split(' ');
  const motsTraites = mots.map((mot) =>
    MOT_HEBREU_RE.test(mot)
      ? [...mot]
          .reverse()
          .map((c) => MIROIR[c] || c)
          .join('')
      : mot
  );
  return motsTraites.reverse().join(' ');
}

// Le titre est compose de segments joints par " - " (ex: "Calendrier - Nom -
// Mois"). Chaque segment est dessine avec son propre appel doc.text():
// jsPDF reinverse deja tout seul un segment sans hebreu des qu'un AUTRE
// segment de la meme chaine contient de l'hebreu (constate empiriquement,
// de façon peu previsible selon le nombre de segments) - dessiner chaque
// segment separement evite ce comportement en s'assurant qu'aucun appel ne
// melange jamais hebreu et non-hebreu.
function dessinerTitre(doc, titre, rtl, x, y, align) {
  if (!rtl) {
    doc.text(titre, x, y, { align });
    return;
  }
  const segments = titre.split(' - ').map((segment) => inverserSiHebreu(segment));
  let curseurX = x;
  segments
    .slice()
    .reverse()
    .forEach((segment, index) => {
      doc.text(segment, curseurX, y, { align: 'right' });
      curseurX -= doc.getTextWidth(segment);
      if (index < segments.length - 1) {
        doc.text(' - ', curseurX, y, { align: 'right' });
        curseurX -= doc.getTextWidth(' - ');
      }
    });
}

function enregistrerPolices(doc) {
  doc.addFileToVFS('DejaVuSans.ttf', DejaVuSansNormal);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', DejaVuSansBold);
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
  doc.setFont('DejaVuSans', 'normal');
}

export function exporterPDF(nomFichier, titre, entetes, lignes, options = {}) {
  const doc = new jsPDF({ orientation: options.orientation || 'landscape' });
  enregistrerPolices(doc);
  const rtl = !!options.rtl;
  const entreprise = options.entreprise;
  const largeurPage = doc.internal.pageSize.getWidth();
  const marge = 14;
  const tailleLogo = 20;
  let curseurY = 15;
  let basLogoY = 0;

  // Position du texte d'entete (nom/adresse/contact de la societe): a droite
  // du logo en LTR, a gauche du logo en RTL (le logo reste du cote "exterieur"
  // de la page, cote droit, pour correspondre a la mise en page de l'appli).
  let decalageTexte = rtl ? largeurPage - marge : marge;
  const alignementEntete = rtl ? 'right' : 'left';

  if (entreprise?.logo) {
    try {
      const xLogo = rtl ? largeurPage - marge - tailleLogo : marge;
      doc.addImage(entreprise.logo, xLogo, curseurY - 6, tailleLogo, tailleLogo, undefined, 'FAST');
      decalageTexte = rtl ? xLogo - 6 : marge + tailleLogo + 6;
      basLogoY = curseurY - 6 + tailleLogo;
    } catch {
      // logo illisible (format inattendu) : on continue sans image
    }
  }

  if (entreprise?.nom) {
    doc.setFontSize(12);
    doc.text(inverserSiHebreu(entreprise.nom), decalageTexte, curseurY, { align: alignementEntete });
    curseurY += 5;
  }
  doc.setFontSize(9);
  if (entreprise?.adresse) {
    doc.text(inverserSiHebreu(entreprise.adresse), decalageTexte, curseurY, { align: alignementEntete });
    curseurY += 4;
  }
  const contact = [entreprise?.telephone, entreprise?.email].filter(Boolean).join(' - ');
  if (contact) {
    doc.text(contact, decalageTexte, curseurY, { align: alignementEntete });
    curseurY += 4;
  }

  curseurY = Math.max(curseurY, basLogoY) + 6;
  doc.setFontSize(14);
  dessinerTitre(doc, titre, rtl, rtl ? largeurPage - marge : marge, curseurY, alignementEntete);
  curseurY += 5;

  const entetesTraitees = entetes.map((h) => inverserSiHebreu(h));
  const lignesTraitees = lignes.map((ligne) => ligne.map((cellule) => inverserSiHebreu(cellule)));

  autoTable(doc, {
    head: [rtl ? [...entetesTraitees].reverse() : entetesTraitees],
    body: lignesTraitees.map((ligne) => (rtl ? [...ligne].reverse() : ligne)),
    startY: curseurY,
    styles: { fontSize: options.fontSize || 8, font: 'DejaVuSans', halign: rtl ? 'right' : 'left' },
    headStyles: { fillColor: [37, 99, 235], font: 'DejaVuSans', fontStyle: 'bold' },
    margin: { left: marge, right: marge },
  });
  doc.save(`${nomFichier}.pdf`);
}
