import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

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
// accents francais s'affichent correctement dans Excel, point-virgule comme
// separateur (convention Excel FR).
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

export function exporterPDF(nomFichier, titre, entetes, lignes, options = {}) {
  const doc = new jsPDF({ orientation: options.orientation || 'landscape' });
  const entreprise = options.entreprise;
  const margeGauche = 14;
  const tailleLogo = 20;
  let curseurY = 15;
  let decalageTexte = margeGauche;
  let basLogoY = 0;

  if (entreprise?.logo) {
    try {
      doc.addImage(entreprise.logo, margeGauche, curseurY - 6, tailleLogo, tailleLogo, undefined, 'FAST');
      decalageTexte = margeGauche + tailleLogo + 6;
      basLogoY = curseurY - 6 + tailleLogo;
    } catch {
      // logo illisible (format inattendu) : on continue sans image
    }
  }

  if (entreprise?.nom) {
    doc.setFontSize(12);
    doc.text(entreprise.nom, decalageTexte, curseurY);
    curseurY += 5;
  }
  doc.setFontSize(9);
  if (entreprise?.adresse) {
    doc.text(entreprise.adresse, decalageTexte, curseurY);
    curseurY += 4;
  }
  const contact = [entreprise?.telephone, entreprise?.email].filter(Boolean).join(' - ');
  if (contact) {
    doc.text(contact, decalageTexte, curseurY);
    curseurY += 4;
  }

  curseurY = Math.max(curseurY, basLogoY) + 6;
  doc.setFontSize(14);
  doc.text(titre, margeGauche, curseurY);
  curseurY += 5;

  autoTable(doc, {
    head: [entetes],
    body: lignes,
    startY: curseurY,
    styles: { fontSize: options.fontSize || 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${nomFichier}.pdf`);
}
