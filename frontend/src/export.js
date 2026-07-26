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

// Export CSV (s'ouvre directement dans Excel/Sheets). BOM UTF-8 pour que les
// accents francais s'affichent correctement dans Excel, point-virgule comme
// separateur (convention Excel FR).
export function exporterCSV(nomFichier, entetes, lignes) {
  const echapper = (val) => {
    const s = val == null ? '' : String(val);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const contenu = [entetes, ...lignes].map((ligne) => ligne.map(echapper).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' });
  telechargerBlob(blob, `${nomFichier}.csv`);
}

export function exporterPDF(nomFichier, titre, entetes, lignes, options = {}) {
  const doc = new jsPDF({ orientation: options.orientation || 'landscape' });
  doc.setFontSize(14);
  doc.text(titre, 14, 15);
  autoTable(doc, {
    head: [entetes],
    body: lignes,
    startY: 20,
    styles: { fontSize: options.fontSize || 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${nomFichier}.pdf`);
}
