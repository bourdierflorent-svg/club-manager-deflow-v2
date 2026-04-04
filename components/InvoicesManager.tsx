import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/index';
import { Invoice, InvoiceRow, UserRole } from '../src/types';
import { DEFLOWER_ENTITY } from '../src/data/invoiceEntities';
import { generateShortId } from '../src/utils';
import InvoiceEditor from './InvoiceEditor';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Plus, ArrowLeft, Save, Download, Trash2, Search,
  FileText, Send, CheckCircle, Edit3
} from 'lucide-react';

const STATUS_BADGES: Record<Invoice['status'], { label: string; className: string }> = {
  draft: { label: 'Brouillon', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  sent: { label: 'Envoyee', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  paid: { label: 'Payee', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const BORDEAUX_RGB: [number, number, number] = [123, 30, 43];
const TAUPE_RGB: [number, number, number] = [196, 180, 160];

const stripAccents = (str: string): string => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const formatPDFCurrency = (amount: number): string => {
  if (!isFinite(amount)) return '0,00 EUR';
  const fixed = Math.abs(amount).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const parts: string[] = [];
  for (let i = intPart.length; i > 0; i -= 3) {
    parts.unshift(intPart.slice(Math.max(0, i - 3), i));
  }
  return (amount < 0 ? '-' : '') + parts.join(' ') + ',' + decPart + ' EUR';
};

const createBlankInvoice = (nextNumber: string): Invoice => ({
  id: '',
  numero: nextNumber,
  dateEvenement: '',
  dateFacture: new Date().toLocaleDateString('fr-FR'),
  entity: DEFLOWER_ENTITY,
  client: { nom: '', adresse: '', ville: '', cp: '', tel: '', email: '' },
  rows: [{ id: generateShortId('row'), description: '', prixUnitaire: '' }],
  totalTTC: 0,
  tva: 0,
  netAPayer: 0,
  status: 'draft',
  createdAt: '',
  createdById: '',
  createdByName: '',
});

const InvoicesManager: React.FC = () => {
  const invoices = useStore(s => s.invoices);
  const currentUser = useStore(s => s.currentUser);
  const createInvoice = useStore(s => s.createInvoice);
  const updateInvoice = useStore(s => s.updateInvoice);
  const deleteInvoice = useStore(s => s.deleteInvoice);
  const loadInvoices = useStore(s => s.loadInvoices);

  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [filterStatus, setFilterStatus] = useState<Invoice['status'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const nextNumber = useMemo(() => {
    const num = (invoices.length + 1).toString().padStart(6, '0');
    return `029-${num}`;
  }, [invoices.length]);

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (filterStatus !== 'all') {
      result = result.filter(inv => inv.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv =>
        inv.client.nom.toLowerCase().includes(q) ||
        inv.numero.toLowerCase().includes(q)
      );
    }
    return result;
  }, [invoices, filterStatus, searchQuery]);

  const handleNew = useCallback(() => {
    setEditingInvoice(createBlankInvoice(nextNumber));
    setSaveError(null);
    setView('editor');
  }, [nextNumber]);

  const handleEdit = useCallback((inv: Invoice) => {
    setEditingInvoice({ ...inv });
    setSaveError(null);
    setView('editor');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setEditingInvoice(null);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingInvoice || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const cleanedRows = editingInvoice.rows.map(r => ({
        ...r,
        prixUnitaire: typeof r.prixUnitaire === 'number' ? r.prixUnitaire : 0,
      }));
      const cleanedInvoice = { ...editingInvoice, rows: cleanedRows };

      if (cleanedInvoice.id) {
        const { id, createdAt, createdById, createdByName, ...data } = cleanedInvoice;
        await updateInvoice(cleanedInvoice.id, data);
      } else {
        const { id, createdAt, createdById, createdByName, ...data } = cleanedInvoice;
        const newId = await createInvoice(data);
        setEditingInvoice(prev => prev ? { ...prev, id: newId } : null);
      }
    } catch {
      setSaveError('Erreur lors de la sauvegarde. Veuillez reessayer.');
    } finally {
      setIsSaving(false);
    }
  }, [editingInvoice, isSaving, createInvoice, updateInvoice]);

  const handleStatusChange = useCallback(async (newStatus: Invoice['status']) => {
    if (!editingInvoice?.id) return;
    await updateInvoice(editingInvoice.id, { status: newStatus });
    setEditingInvoice(prev => prev ? { ...prev, status: newStatus } : null);
  }, [editingInvoice, updateInvoice]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm || deleteConfirmText !== 'SUPPRIMER') return;
    await deleteInvoice(deleteConfirm);
    setDeleteConfirm(null);
    setDeleteConfirmText('');
    if (editingInvoice?.id === deleteConfirm) {
      handleBack();
    }
  }, [deleteConfirm, deleteConfirmText, deleteInvoice, editingInvoice, handleBack]);

  const handleExportPDF = useCallback(() => {
    if (!editingInvoice) return;

    const inv = editingInvoice;
    const entity = inv.entity;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const marginL = 20;
    const marginR = pageW - 20;

    // Full page taupe background
    doc.setFillColor(...TAUPE_RGB);
    doc.rect(0, 0, pageW, pageH, 'F');

    // Title
    doc.setTextColor(...BORDEAUX_RGB);
    doc.setFont('times', 'bold');
    doc.setFontSize(42);
    doc.text('Facture', marginL, 35);
    const titleW = doc.getTextWidth('Facture');
    doc.setDrawColor(...BORDEAUX_RGB);
    doc.setLineWidth(0.8);
    doc.line(marginL, 37, marginL + titleW, 37);

    // Logo "Deflower" + "avec amour" (top right)
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(22);
    doc.text(entity.logo, marginR, 28, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('times', 'italic');
    doc.text('"avec amour"', marginR, 34, { align: 'right' });

    // "Pour" section
    let y = 55;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Pour', marginL, y);
    y += 6;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.text(stripAccents(inv.client.nom || '-'), marginL, y); y += 5;
    if (inv.client.adresse) { doc.text(stripAccents(inv.client.adresse), marginL, y); y += 5; }
    if (inv.client.ville) { doc.text(stripAccents(inv.client.ville), marginL, y); y += 5; }
    if (inv.client.cp) { doc.text(inv.client.cp, marginL, y); y += 5; }
    if (inv.client.tel) { y += 2; doc.text(inv.client.tel, marginL, y); y += 5; }
    if (inv.client.email) { doc.text(inv.client.email, marginL, y); y += 5; }

    // Dates + N° (right)
    let dateY = 55;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('Date Evenement', marginR, dateY, { align: 'right' });
    dateY += 5;
    doc.setFont('times', 'normal');
    doc.text(inv.dateEvenement || '-', marginR, dateY, { align: 'right' });
    dateY += 9;
    doc.setFont('times', 'bold');
    doc.text('Date Facture', marginR, dateY, { align: 'right' });
    dateY += 5;
    doc.setFont('times', 'normal');
    doc.text(inv.dateFacture || '-', marginR, dateY, { align: 'right' });
    dateY += 9;
    doc.setFont('times', 'bold');
    doc.text('N Facture', marginR, dateY, { align: 'right' });
    dateY += 5;
    doc.setFont('times', 'normal');
    doc.text(inv.numero || '-', marginR, dateY, { align: 'right' });

    // Line items table
    const tableStartY = Math.max(y, dateY) + 15;
    const tableBody = inv.rows
      .filter(r => r.description || (typeof r.prixUnitaire === 'number' && r.prixUnitaire > 0))
      .map(r => {
        const p = typeof r.prixUnitaire === 'number' ? r.prixUnitaire : 0;
        return [stripAccents(r.description || ''), formatPDFCurrency(p)];
      });
    while (tableBody.length < 5) tableBody.push(['', '']);

    autoTable(doc, {
      head: [['Description', 'Montant TTC']],
      body: tableBody,
      startY: tableStartY,
      margin: { left: marginL, right: 20 },
      styles: {
        fontSize: 10, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
        textColor: BORDEAUX_RGB, fillColor: [196, 180, 160] as [number, number, number],
        lineColor: [180, 160, 140] as [number, number, number], lineWidth: 0.2, font: 'times',
      },
      headStyles: {
        fillColor: BORDEAUX_RGB, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, font: 'times',
      },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'right' } },
    });

    // Totals
    const totalsStartY = (doc as any).lastAutoTable.finalY + 8;
    const totalsX = 115;
    const totalsW = marginR - totalsX;
    const labelX = totalsX + 4;
    const valueX = marginR - 4;

    let tY = totalsStartY;
    doc.setDrawColor(180, 160, 140);
    doc.setLineWidth(0.2);
    doc.rect(totalsX, tY, totalsW, 9);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BORDEAUX_RGB);
    doc.text('Total TTC', labelX, tY + 6.5);
    doc.setFont('times', 'normal');
    doc.text(formatPDFCurrency(inv.totalTTC), valueX, tY + 6.5, { align: 'right' });

    tY += 9;
    doc.rect(totalsX, tY, totalsW, 9);
    doc.setFont('times', 'bold');
    doc.text('Dont TVA (20%)', labelX, tY + 6.5);
    doc.setFont('times', 'normal');
    doc.text(formatPDFCurrency(inv.tva), valueX, tY + 6.5, { align: 'right' });

    tY += 9;
    doc.setFillColor(...BORDEAUX_RGB);
    doc.rect(totalsX, tY, totalsW, 10, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Net a payer*', labelX, tY + 7);
    doc.text(formatPDFCurrency(inv.netAPayer), valueX, tY + 7, { align: 'right' });

    tY += 13;
    doc.setTextColor(...BORDEAUX_RGB);
    doc.setFont('times', 'italic');
    doc.setFontSize(7);
    doc.text('*Prix exprime en TTC - TVA 20% deja incluse', totalsX, tY);

    // Payment terms
    let condY = tY + 20;
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BORDEAUX_RGB);
    doc.text('Condition de reglement:', marginL, condY);
    condY += 5;
    doc.text('payement sous 30 jours', marginL, condY);
    condY += 10;
    doc.setFont('times', 'bold');
    doc.text('Thank you for your business!', marginL, condY);

    // Footer bar
    const footerH = 30;
    const footerTop = pageH - footerH;
    doc.setFillColor(180, 164, 145);
    doc.rect(0, footerTop, pageW, footerH, 'F');

    // Logo in footer
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(22);
    doc.setTextColor(...BORDEAUX_RGB);
    doc.text(entity.logo, marginL, footerTop + 16);
    doc.setFontSize(9);
    doc.setFont('times', 'italic');
    doc.text('"avec amour"', marginL, footerTop + 22);

    // Entity info
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    const infoX = marginR;
    let fY = footerTop + 7;
    doc.text(entity.nom, infoX, fY, { align: 'right' });
    fY += 4;
    doc.setFont('times', 'normal');
    doc.text(`Siege Social: ${stripAccents(entity.siege)}`, infoX, fY, { align: 'right' });
    fY += 4;
    doc.text(`TVA intracommunautaire: ${entity.tva}`, infoX, fY, { align: 'right' });
    fY += 4;
    doc.text(`SIREN ${entity.siren}`, infoX, fY, { align: 'right' });
    fY += 4;
    doc.text(`Contact: ${entity.contact}`, infoX, fY, { align: 'right' });

    const filename = `Facture_${inv.numero.replace(/\//g, '-')}_${stripAccents(inv.client.nom || 'client').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  }, [editingInvoice]);

  const formatCurrency = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' EUR';

  if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.MANAGER && currentUser.role !== UserRole.WAITER)) {
    return <p className="text-white/40 text-center p-8">Acces non autorise.</p>;
  }

  // ============== EDITOR VIEW ==============
  if (view === 'editor' && editingInvoice) {
    const badge = STATUS_BADGES[editingInvoice.status];
    return (
      <div className="space-y-4 fade-in-up">
        <div className="bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4 rounded-xl space-y-3 sm:space-y-0">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <button onClick={handleBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.className}`}>{badge.label}</span>
            <div className="hidden sm:block flex-1" />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {editingInvoice.status === 'draft' && (
              <button onClick={() => handleStatusChange('sent')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                <Send className="w-3.5 h-3.5" /> Envoyee
              </button>
            )}
            {(editingInvoice.status === 'draft' || editingInvoice.status === 'sent') && (
              <button onClick={() => handleStatusChange('paid')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                <CheckCircle className="w-3.5 h-3.5" /> Payee
              </button>
            )}
            <div className="flex-1 sm:hidden" />
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> {isSaving ? '...' : 'Enregistrer'}
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-colors">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            {editingInvoice.id && (
              <button onClick={() => setDeleteConfirm(editingInvoice.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {saveError && <p className="text-red-400 text-xs font-semibold mt-2">{saveError}</p>}
        </div>

        <InvoiceEditor invoice={editingInvoice} onChange={setEditingInvoice} />

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setDeleteConfirm(null); setDeleteConfirmText(''); }}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-red-400">Supprimer la facture ?</h3>
              <p className="text-white/60 text-sm">Tapez <strong className="text-red-400">SUPPRIMER</strong> pour confirmer.</p>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-red-500/50"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
              />
              <div className="flex gap-3">
                <button onClick={() => { setDeleteConfirm(null); setDeleteConfirmText(''); }} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-white/5 text-white/60 hover:bg-white/10">Annuler</button>
                <button onClick={handleDelete} disabled={deleteConfirmText !== 'SUPPRIMER'} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed">Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============== LIST VIEW ==============
  return (
    <div className="space-y-4 fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/[0.03] border border-white/[0.06] p-4 sm:p-6 rounded-xl">
        <div>
          <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
            <FileText className="w-5 h-5 text-white" /> Factures
          </h3>
          <p className="text-white/40 text-xs font-semibold">{invoices.length} facture{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-xl font-bold uppercase text-xs shadow-xl transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle Facture
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/50"
            placeholder="Rechercher par client ou n de facture..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'draft', 'sent', 'paid'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                filterStatus === s ? 'bg-white text-black' : 'bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {s === 'all' ? 'Toutes' : STATUS_BADGES[s].label}
            </button>
          ))}
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Aucune facture</p>
          <p className="text-xs mt-1">Creez votre premiere facture avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-bold text-white/40 uppercase">N</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-white/40 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-white/40 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-white/40 uppercase">Total TTC</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-white/40 uppercase">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-white/40 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const badge = STATUS_BADGES[inv.status];
                  return (
                    <tr key={inv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-white/80">{inv.numero}</td>
                      <td className="px-4 py-3 text-sm text-white font-semibold">{inv.client.nom || '—'}</td>
                      <td className="px-4 py-3 text-sm text-white/60">{inv.dateFacture}</td>
                      <td className="px-4 py-3 text-sm text-white font-semibold text-right">{formatCurrency(inv.totalTTC)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleEdit(inv)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.map(inv => {
              const badge = STATUS_BADGES[inv.status];
              return (
                <div key={inv.id} onClick={() => handleEdit(inv)} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 active:bg-white/[0.06] transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-bold text-white">{inv.client.nom || 'Sans nom'}</p>
                      <p className="text-xs text-white/40 font-mono">{inv.numero}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs text-white/40">{inv.dateFacture}</p>
                    <p className="text-sm font-bold text-white">{formatCurrency(inv.totalTTC)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default InvoicesManager;
