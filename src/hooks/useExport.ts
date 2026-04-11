/**
 * hooks/useExport.ts
 * Hook pour le récap PDF (téléchargement + partage), séparation Club/Bar.
 */

import { useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EveningEvent } from '../types';
import { formatDate, aggregateEventData, AggregatedClientData } from '../utils';

/**
 * Formate un montant pour jsPDF (formatage manuel sans Unicode)
 */
const formatPDFCurrency = (amount: number): string => {
  const rounded = Math.round(amount);
  const str = Math.abs(rounded).toString();
  const parts: string[] = [];
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.slice(Math.max(0, i - 3), i));
  }
  return (rounded < 0 ? '-' : '') + parts.join(' ') + ' EUR';
};

// ============================================
// 📤 HELPER: Share via Web Share API with download fallback
// ============================================
/**
 * Tente de partager un fichier via l'API Web Share Level 2 (iOS 15+, Android récent).
 * Fallback sur un download traditionnel via <a download> si non supporté.
 *
 * Pourquoi : sur iPad Safari, doc.save() ignore l'attribut
 * download et ouvre le fichier dans un onglet de prévisualisation via blob URL.
 * Quand l'utilisateur partage depuis ce viewer, iOS partage l'URL de la page
 * (blob:https://...) au lieu du fichier.
 */
const shareOrDownloadFile = async (
  blob: Blob,
  filename: string,
  shareMeta: { title: string; text: string }
): Promise<void> => {
  const file = new File([blob], filename, { type: blob.type });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: shareMeta.title, text: shareMeta.text });
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[shareOrDownload] navigator.share failed, falling back to download:', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ============================================
// TYPES
// ============================================

export interface UseExportReturn {
  /** Télécharger le PDF (doc.save → download desktop, aperçu Safari sur iPad) */
  exportToPDF: (event: EveningEvent) => Promise<void>;
  /** Partager le PDF via Web Share API (iOS/Android), fallback download sur desktop */
  sharePDF: (event: EveningEvent) => Promise<void>;
}

export interface ExportOptions {
  includeItems?: boolean;
  filename?: string;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export const useExport = (options: ExportOptions = {}): UseExportReturn => {
  const {
    includeItems = true,
  } = options;

  const getFilename = useCallback((event: EveningEvent, extension: string): string => {
    const baseName = options.filename || `Deflower_${event.date}`;
    return `${baseName}.${extension}`;
  }, [options.filename]);

  /**
   * Formater les données pour le PDF
   */
  const formatDataForPDF = (data: AggregatedClientData[]) => {
    return data.map((row: AggregatedClientData) => {
      const itemsList = Object.entries(row.consolidatedItems)
        .map(([name, qty]) => `${qty}x ${name}`)
        .join('\n');

      const baseRow = [
        row.tableNumber,
        row.clientName,
      ];

      if (includeItems) {
        baseRow.push(itemsList);
      }

      baseRow.push(row.waiterName);
      baseRow.push(row.apporteur || '-');
      baseRow.push(`${row.totalAmount.toFixed(0)} EUR`);

      return baseRow;
    });
  };

  /**
   * Construit le document jsPDF pour un événement.
   * Utilisé à la fois par exportToPDF (download) et sharePDF (share sheet).
   */
  const buildEventPDF = useCallback((event: EveningEvent): {
    doc: jsPDF;
    filename: string;
    shareMeta: { title: string; text: string };
  } | null => {
    if (!event) return null;

    const aggregatedData = aggregateEventData(event);
    const clubData = aggregatedData.filter(r => r.zone === 'club');
    const barData = aggregatedData.filter(r => r.zone === 'bar');
    const doc = new jsPDF();
    const filename = getFilename(event, 'pdf');
    const shareMeta = {
      title: `Récap Deflower — ${formatDate(event.date)}`,
      text: `Récapitulatif de la soirée du ${formatDate(event.date)}`,
    };

    const caTotal = event.totalRevenue || aggregatedData.reduce((acc, r) => acc + r.totalAmount, 0);
    const caClub = clubData.reduce((acc, r) => acc + r.totalAmount, 0);
    const caBar = barData.reduce((acc, r) => acc + r.totalAmount, 0);

    // En-tête
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DEFLOWER - Recapitulatif', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Soiree: ${event.name || 'Sans nom'}`, 14, 30);
    doc.text(`Date: ${formatDate(event.date)}`, 14, 37);

    // CA résumé
    doc.setFont('helvetica', 'bold');
    doc.text(`CA TOTAL: ${formatPDFCurrency(caTotal)}`, 14, 47);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Club: ${formatPDFCurrency(caClub)}  |  Bar: ${formatPDFCurrency(caBar)}`, 14, 54);

    // Colonnes
    const columns = ['Table', 'Client'];
    if (includeItems) columns.push('Consommation');
    columns.push('Serveur', 'Apporteur', 'Total');

    let currentY = 64;

    const tableOptions = {
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [255, 255, 255] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] },
      columnStyles: includeItems ? { 2: { cellWidth: 50 } } : {},
    };

    // Section CLUB
    if (clubData.length > 0) {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('ZONE CLUB', 14, currentY);
      currentY += 6;

      autoTable(doc, {
        head: [columns],
        body: formatDataForPDF(clubData),
        startY: currentY,
        ...tableOptions,
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`CA Club: ${formatPDFCurrency(caClub)}`, 14, currentY);
      currentY += 10;
    }

    // Section BAR
    if (barData.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('ZONE BAR', 14, currentY);
      currentY += 6;

      autoTable(doc, {
        head: [columns],
        body: formatDataForPDF(barData),
        startY: currentY,
        ...tableOptions,
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`CA Bar: ${formatPDFCurrency(caBar)}`, 14, currentY);
      currentY += 10;
    }

    // CA Total en fin
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, 196, currentY);
    currentY += 8;

    doc.setFontSize(14);
    doc.text(`CA TOTAL: ${formatPDFCurrency(caTotal)}`, 14, currentY);

    // Pied de page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} / ${pageCount} - Genere le ${new Date().toLocaleDateString('fr-FR')}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    return { doc, filename, shareMeta };
  }, [includeItems, getFilename]);

  /**
   * Télécharger le PDF (doc.save → download sur desktop, aperçu Safari sur iPad).
   */
  const exportToPDF = useCallback(async (event: EveningEvent) => {
    const built = buildEventPDF(event);
    if (!built) return;
    built.doc.save(built.filename);
  }, [buildEventPDF]);

  /**
   * Partager le PDF via Web Share API (iOS/Android), fallback download sur desktop.
   */
  const sharePDF = useCallback(async (event: EveningEvent) => {
    const built = buildEventPDF(event);
    if (!built) return;
    const blob = built.doc.output('blob') as Blob;
    await shareOrDownloadFile(blob, built.filename, built.shareMeta);
  }, [buildEventPDF]);

  return {
    exportToPDF,
    sharePDF,
  };
};

// ============================================
// HOOK SIMPLIFIE
// ============================================

export const useQuickExport = () => {
  const { exportToPDF, sharePDF } = useExport({
    includeItems: true,
  });

  return { exportToPDF, sharePDF };
};
