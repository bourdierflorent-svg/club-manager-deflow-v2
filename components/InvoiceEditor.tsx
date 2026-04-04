import React, { useCallback } from 'react';
import { Invoice, InvoiceRow } from '../src/types';
import { DEFLOWER_ENTITY } from '../src/data/invoiceEntities';
import { Plus, X } from 'lucide-react';
import { generateShortId } from '../src/utils';

interface InvoiceEditorProps {
  invoice: Invoice;
  onChange: (updated: Invoice) => void;
  readOnly?: boolean;
}

const BORDEAUX = '#7B1E2B';

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ invoice, onChange, readOnly }) => {
  const entity = DEFLOWER_ENTITY;

  const updateClient = useCallback((field: string, value: string) => {
    onChange({ ...invoice, client: { ...invoice.client, [field]: value } });
  }, [invoice, onChange]);

  const updateRow = useCallback((rowId: string, field: keyof InvoiceRow, value: string | number) => {
    const rows = invoice.rows.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, [field]: value };
    });
    const totalTTC = rows.reduce((sum, r) => {
      const p = typeof r.prixUnitaire === 'number' ? r.prixUnitaire : 0;
      return sum + p;
    }, 0);
    const tva = totalTTC - totalTTC / 1.2;
    onChange({ ...invoice, rows, totalTTC, tva, netAPayer: totalTTC });
  }, [invoice, onChange]);

  const addRow = useCallback(() => {
    const newRow: InvoiceRow = { id: generateShortId('row'), description: '', prixUnitaire: '' };
    onChange({ ...invoice, rows: [...invoice.rows, newRow] });
  }, [invoice, onChange]);

  const removeRow = useCallback((rowId: string) => {
    const rows = invoice.rows.filter(r => r.id !== rowId);
    const totalTTC = rows.reduce((sum, r) => {
      const p = typeof r.prixUnitaire === 'number' ? r.prixUnitaire : 0;
      return sum + p;
    }, 0);
    const tva = totalTTC - totalTTC / 1.2;
    onChange({ ...invoice, rows, totalTTC, tva, netAPayer: totalTTC });
  }, [invoice, onChange]);

  const inputClass = readOnly
    ? 'bg-transparent outline-none w-full'
    : 'bg-transparent outline-none w-full border-b border-dashed border-[#7B1E2B]/30 focus:border-[#7B1E2B]/60 transition-colors';

  const formatNumber = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      id="invoice-print-area"
      className="w-full max-w-[210mm] mx-auto shadow-2xl"
      style={{ backgroundColor: entity.bgColor, color: BORDEAUX, fontFamily: 'Georgia, serif' }}
    >
      {/* Header */}
      <div className="p-4 sm:p-8 pb-4 flex flex-col sm:flex-row justify-between items-start gap-3">
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold" style={{ color: BORDEAUX }}>Facture</h1>
          <div className="mt-2 flex gap-6 text-sm">
            <div>
              <span className="opacity-60">N° </span>
              <input
                className={`${inputClass} font-semibold w-32`}
                value={invoice.numero}
                onChange={e => onChange({ ...invoice, numero: e.target.value })}
                readOnly={readOnly}
                placeholder="029-000001"
              />
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xl sm:text-2xl font-bold italic tracking-wide" style={{ color: BORDEAUX }}>{entity.logo}</p>
          <p className="text-xs italic opacity-40">"avec amour"</p>
        </div>
      </div>

      {/* Client + Meta */}
      <div className="px-4 sm:px-8 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Client</p>
          <div className="space-y-1">
            <input className={`${inputClass} font-bold text-lg`} value={invoice.client.nom} onChange={e => updateClient('nom', e.target.value)} readOnly={readOnly} placeholder="Nom du client" />
            <input className={inputClass} value={invoice.client.adresse} onChange={e => updateClient('adresse', e.target.value)} readOnly={readOnly} placeholder="Adresse" />
            <div className="flex gap-2">
              <input className={`${inputClass} w-20`} value={invoice.client.cp} onChange={e => updateClient('cp', e.target.value)} readOnly={readOnly} placeholder="CP" />
              <input className={inputClass} value={invoice.client.ville} onChange={e => updateClient('ville', e.target.value)} readOnly={readOnly} placeholder="Ville" />
            </div>
            <input className={inputClass} value={invoice.client.tel} onChange={e => updateClient('tel', e.target.value)} readOnly={readOnly} placeholder="Telephone" />
            <input className={inputClass} value={invoice.client.email} onChange={e => updateClient('email', e.target.value)} readOnly={readOnly} placeholder="Email" />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Date de facture</p>
            <input className={`${inputClass} font-semibold`} value={invoice.dateFacture} onChange={e => onChange({ ...invoice, dateFacture: e.target.value })} readOnly={readOnly} placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Date de l'evenement</p>
            <input className={`${inputClass} font-semibold`} value={invoice.dateEvenement} onChange={e => onChange({ ...invoice, dateEvenement: e.target.value })} readOnly={readOnly} placeholder="JJ/MM/AAAA" />
          </div>
        </div>
      </div>

      {/* Table — Desktop */}
      <div className="px-4 sm:px-8 py-4">
        <div className="hidden sm:block">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: BORDEAUX, color: '#fff' }}>
                <th className="text-left px-3 py-2 text-xs font-bold uppercase">Description</th>
                <th className="text-right px-3 py-2 text-xs font-bold uppercase w-40">Montant TTC</th>
                {!readOnly && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {invoice.rows.map((row) => (
                <tr key={row.id} className="border-b border-[#7B1E2B]/10">
                  <td className="px-3 py-2">
                    <input className={`${inputClass} text-sm`} value={row.description} onChange={e => updateRow(row.id, 'description', e.target.value)} readOnly={readOnly} placeholder="Description..." />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input className={`${inputClass} text-sm text-right w-full`} type="number" min={0} step="0.01" value={row.prixUnitaire} onChange={e => updateRow(row.id, 'prixUnitaire', e.target.value === '' ? '' as unknown as number : Number(e.target.value))} readOnly={readOnly} placeholder="0.00" />
                  </td>
                  {!readOnly && (
                    <td className="px-1 py-2">
                      <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-[#7B1E2B]/10 transition-colors">
                        <X className="w-4 h-4 opacity-40 hover:opacity-100" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table — Mobile cards */}
        <div className="sm:hidden space-y-3">
          <div className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: BORDEAUX }}>
            Prestations
          </div>
          {invoice.rows.map((row) => (
            <div key={row.id} className="border border-[#7B1E2B]/15 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <input className={`${inputClass} text-sm flex-1`} value={row.description} onChange={e => updateRow(row.id, 'description', e.target.value)} readOnly={readOnly} placeholder="Description..." />
                {!readOnly && (
                  <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-[#7B1E2B]/10 transition-colors shrink-0">
                    <X className="w-4 h-4 opacity-40 hover:opacity-100" />
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold uppercase opacity-50">Montant TTC</p>
                <input className={`${inputClass} text-sm text-right w-32`} type="number" min={0} step="0.01" value={row.prixUnitaire} onChange={e => updateRow(row.id, 'prixUnitaire', e.target.value === '' ? '' as unknown as number : Number(e.target.value))} readOnly={readOnly} placeholder="0.00" />
              </div>
            </div>
          ))}
        </div>

        {!readOnly && (
          <button
            onClick={addRow}
            className="mt-3 w-full py-2 border-2 border-dashed rounded-lg text-sm font-semibold opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
            style={{ borderColor: BORDEAUX, color: BORDEAUX }}
          >
            <Plus className="w-4 h-4" /> Ajouter une ligne
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="px-4 sm:px-8 py-4 flex justify-end">
        <div className="w-full sm:w-72 space-y-2">
          <div className="flex justify-between text-sm font-semibold">
            <span>Total TTC</span>
            <span>{formatNumber(invoice.totalTTC)} EUR</span>
          </div>
          <div className="flex justify-between text-sm opacity-70">
            <span>Dont TVA (20%)</span>
            <span>{formatNumber(invoice.tva)} EUR</span>
          </div>
          <div className="flex justify-between px-4 py-3 rounded-lg text-lg font-bold" style={{ backgroundColor: BORDEAUX, color: '#fff' }}>
            <span>Net a payer</span>
            <span>{formatNumber(invoice.netAPayer)} EUR</span>
          </div>
          <p className="text-[10px] opacity-50 italic mt-1">*Prix exprime en TTC — TVA 20% deja incluse</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3" style={{ backgroundColor: `${entity.bgColor}dd` }}>
        <div className="opacity-30">
          <p className="text-2xl sm:text-3xl font-bold italic tracking-wide" style={{ color: BORDEAUX }}>{entity.logo}</p>
          <p className="text-xs italic" style={{ color: BORDEAUX }}>"avec amour"</p>
        </div>
        <div className="text-left sm:text-right text-[10px] opacity-60 space-y-0.5">
          <p>{entity.nom}</p>
          <p>Siege : {entity.siege}</p>
          <p>TVA : {entity.tva}</p>
          <p>SIREN : {entity.siren}</p>
          <p>{entity.contact}</p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceEditor;
