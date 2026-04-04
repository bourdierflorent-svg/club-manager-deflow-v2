/**
 * hooks/useExport.ts
 * Hook pour les exports PDF et Excel
 *
 * @description Centralise la logique d'export avec séparation Club/Bar
 */

import { useCallback } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
// TYPES
// ============================================

export interface UseExportReturn {
  exportToPDF: (event: EveningEvent) => void;
  exportToExcel: (event: EveningEvent) => void;
  exportBoth: (event: EveningEvent) => void;
}

export interface ExportOptions {
  includeItems?: boolean;
  includeWaiterStats?: boolean;
  filename?: string;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export const useExport = (options: ExportOptions = {}): UseExportReturn => {
  const {
    includeItems = true,
    includeWaiterStats = false,
  } = options;

  const getFilename = useCallback((event: EveningEvent, extension: string): string => {
    const baseName = options.filename || `Deflower_${event.date}`;
    return `${baseName}.${extension}`;
  }, [options.filename]);

  /**
   * Exporter en Excel - avec séparation Club/Bar
   */
  const exportToExcel = useCallback((event: EveningEvent) => {
    if (!event) return;

    const aggregatedData = aggregateEventData(event);
    const clubData = aggregatedData.filter(r => r.zone === 'club');
    const barData = aggregatedData.filter(r => r.zone === 'bar');
    const caTotal = event.totalRevenue || aggregatedData.reduce((acc, r) => acc + r.totalAmount, 0);
    const caClub = clubData.reduce((acc, r) => acc + r.totalAmount, 0);
    const caBar = barData.reduce((acc, r) => acc + r.totalAmount, 0);

    const buildRows = (data: AggregatedClientData[]) => {
      return data.map((row: AggregatedClientData) => {
        const itemsList = Object.entries(row.consolidatedItems)
          .map(([name, qty]) => `${qty}x ${name}`)
          .join(', ');
        return {
          'Table': row.tableNumber,
          'Client': row.clientName,
          ...(includeItems ? { 'Consommation': itemsList } : {}),
          'Serveur': row.waiterName,
          'Apporteur': row.apporteur || '-',
          'Total (EUR)': row.totalAmount.toFixed(0),
        };
      });
    };

    const emptyRow = {
      'Table': '', 'Client': '', ...(includeItems ? { 'Consommation': '' } : {}),
      'Serveur': '', 'Apporteur': '', 'Total (EUR)': '',
    };

    const excelData: any[] = [];

    // Section CLUB
    if (clubData.length > 0) {
      excelData.push({ ...emptyRow, 'Table': '--- CLUB ---' });
      excelData.push(...buildRows(clubData));
      excelData.push({ ...emptyRow, 'Client': 'CA CLUB', 'Total (EUR)': caClub.toFixed(0) });
      excelData.push(emptyRow);
    }

    // Section BAR
    if (barData.length > 0) {
      excelData.push({ ...emptyRow, 'Table': '--- BAR ---' });
      excelData.push(...buildRows(barData));
      excelData.push({ ...emptyRow, 'Client': 'CA BAR', 'Total (EUR)': caBar.toFixed(0) });
      excelData.push(emptyRow);
    }

    // CA Total
    excelData.push({ ...emptyRow, 'Client': 'CA TOTAL', 'Total (EUR)': caTotal.toFixed(0) });

    // Créer le workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif');

    // Ajouter feuille stats serveurs si demandé
    if (includeWaiterStats && event.waiterStats && event.waiterStats.length > 0) {
      const waiterData = event.waiterStats.map(stat => ({
        'Serveur': stat.name,
        'CA': stat.revenue,
        'Tables': stat.tablesCount,
      }));
      const wsWaiters = XLSX.utils.json_to_sheet(waiterData);
      XLSX.utils.book_append_sheet(wb, wsWaiters, 'Stats Serveurs');
    }

    XLSX.writeFile(wb, getFilename(event, 'xlsx'));
  }, [includeItems, includeWaiterStats, getFilename]);

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
   * Exporter en PDF - avec séparation Club/Bar
   */
  const exportToPDF = useCallback((event: EveningEvent) => {
    if (!event) return;

    const aggregatedData = aggregateEventData(event);
    const clubData = aggregatedData.filter(r => r.zone === 'club');
    const barData = aggregatedData.filter(r => r.zone === 'bar');
    const doc = new jsPDF();

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

    doc.save(getFilename(event, 'pdf'));
  }, [includeItems, includeWaiterStats, getFilename]);

  const exportBoth = useCallback((event: EveningEvent) => {
    exportToPDF(event);
    exportToExcel(event);
  }, [exportToPDF, exportToExcel]);

  return {
    exportToPDF,
    exportToExcel,
    exportBoth,
  };
};

// ============================================
// HOOK SIMPLIFIE
// ============================================

export const useQuickExport = () => {
  const { exportToPDF, exportToExcel } = useExport({
    includeItems: true,
    includeWaiterStats: true,
  });

  return { exportToPDF, exportToExcel };
};
