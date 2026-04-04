import React, { useState, useCallback, useMemo } from 'react';
import { ArchiveTableEntry, ArchiveStructuredItem } from '../../src/types';
import { X, Trash2, Plus, Save } from 'lucide-react';

interface EditRecapModalProps {
  isOpen: boolean;
  entry: ArchiveTableEntry;
  entryIndex: number;
  onSave: (entryIndex: number, updatedEntry: ArchiveTableEntry) => void;
  onDelete: (entryIndex: number) => void;
  onClose: () => void;
}

const SIZES = ['standard', 'magnum', 'jeroboam', 'mathusalem'];

const EditRecapModal: React.FC<EditRecapModalProps> = ({ isOpen, entry, entryIndex, onSave, onDelete, onClose }) => {
  const [clientName, setClientName] = useState(entry.clientName);
  const [tableNumber, setTableNumber] = useState(entry.tableNumber);
  const [apporteur, setApporteur] = useState(entry.apporteur);
  const [waiterName, setWaiterName] = useState(entry.waiterName || '');
  const [items, setItems] = useState<ArchiveStructuredItem[]>(() => {
    if (entry.structuredItems && entry.structuredItems.length > 0) {
      return entry.structuredItems.map(si => ({ ...si }));
    }
    // Fallback: parse from string items and distribute total evenly
    const parsed = (entry.items || []).map(itemStr => {
      const match = itemStr.match(/^(\d+)x\s+(.+?)\s+\((.+?)\)$/);
      if (match) {
        return {
          productName: match[2],
          size: match[3],
          quantity: parseInt(match[1]),
          unitPrice: 0,
          subtotal: 0
        };
      }
      return { productName: itemStr, size: 'standard', quantity: 1, unitPrice: 0, subtotal: 0 };
    });
    // Distribute total amount proportionally by quantity
    const totalQty = parsed.reduce((acc, p) => acc + p.quantity, 0);
    if (totalQty > 0 && entry.totalAmount > 0) {
      const pricePerUnit = Math.round(entry.totalAmount / totalQty);
      parsed.forEach(p => {
        p.unitPrice = pricePerUnit;
        p.subtotal = p.quantity * pricePerUnit;
      });
    }
    return parsed;
  });

  const originalTotal = entry.totalAmount;

  const newTotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }, [items]);

  const diff = newTotal - originalTotal;

  const updateItem = useCallback((index: number, field: keyof ArchiveStructuredItem, value: string | number) => {
    setItems(prev => {
      // Si quantite mise a 0, supprimer l'article
      if (field === 'quantity' && value === 0) {
        return prev.filter((_, i) => i !== index);
      }
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index].subtotal = updated[index].quantity * updated[index].unitPrice;
      return updated;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { productName: '', size: 'standard', quantity: 1, unitPrice: 0, subtotal: 0 }]);
  }, []);

  const handleSave = useCallback(() => {
    if (!clientName.trim()) return;
    const validItems = items.filter(i => i.quantity > 0 && i.productName.trim());
    if (validItems.length === 0) return;

    const finalItems = validItems.map(i => ({ ...i, subtotal: i.quantity * i.unitPrice }));
    const updatedEntry: ArchiveTableEntry = {
      clientName: clientName.trim(),
      tableNumber: tableNumber.trim(),
      apporteur: apporteur.toUpperCase().trim(),
      waiterName: waiterName.trim() || undefined,
      totalAmount: finalItems.reduce((acc, i) => acc + i.subtotal, 0),
      items: finalItems.map(i => `${i.quantity}x ${i.productName} (${i.size})`),
      zone: entry.zone,
      structuredItems: finalItems
    };

    onSave(entryIndex, updatedEntry);
  }, [clientName, tableNumber, apporteur, waiterName, items, entry.zone, entryIndex, onSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-xl p-4 sm:p-8 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-white">Modifier le Recap</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-800 rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pr-1 sm:pr-2">
          {/* Info fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Client</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white font-semibold uppercase outline-none focus:border-zinc-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Table</label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white font-semibold outline-none focus:border-zinc-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Apporteur</label>
              <input
                type="text"
                value={apporteur}
                onChange={(e) => setApporteur(e.target.value.toUpperCase())}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white font-semibold uppercase outline-none focus:border-zinc-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Serveur</label>
              <input
                type="text"
                value={waiterName}
                onChange={(e) => setWaiterName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white font-semibold outline-none focus:border-zinc-500 transition-all"
              />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-medium text-zinc-500">Items</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="bg-zinc-800 p-3 sm:p-4 rounded-xl space-y-3">
                  {/* Ligne 1: Produit + Taille */}
                  <div className="flex gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Produit</label>
                      <input
                        type="text"
                        value={item.productName}
                        onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                        className="w-full bg-transparent border border-zinc-700 rounded-lg py-2 px-3 text-white text-sm font-semibold outline-none focus:border-zinc-500"
                        placeholder="Nom"
                      />
                    </div>
                    <div className="w-[100px] sm:w-[120px] shrink-0">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Taille</label>
                      <select
                        value={item.size}
                        onChange={(e) => updateItem(idx, 'size', e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-2 text-white text-xs font-semibold outline-none"
                      >
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Ligne 2: Qte + Prix + Sous-total + Supprimer */}
                  <div className="flex gap-2 sm:gap-3 items-end">
                    <div className="w-[60px] sm:w-[70px] shrink-0">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Qte</label>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full bg-transparent border border-zinc-700 rounded-lg py-2 px-2 sm:px-3 text-white text-sm font-semibold outline-none text-center focus:border-zinc-500"
                      />
                    </div>
                    <div className="w-[70px] sm:w-[90px] shrink-0">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">Prix U.</label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-transparent border border-zinc-700 rounded-lg py-2 px-2 sm:px-3 text-white text-sm font-semibold outline-none text-center focus:border-zinc-500"
                      />
                    </div>
                    <div className="w-[55px] sm:w-[80px] shrink-0 text-center">
                      <label className="text-xs font-medium text-zinc-500 block mb-1">S/Total</label>
                      <p className="text-zinc-400 font-semibold text-sm py-2">{(item.quantity * item.unitPrice).toFixed(0)}</p>
                    </div>
                    <div className="flex-1"></div>
                    <button onClick={() => removeItem(idx)} className="shrink-0 p-2.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all" title="Supprimer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 && (
                <div className="text-center py-6 text-zinc-600 text-sm font-semibold">
                  Aucun item - cliquez "Ajouter" pour commencer
                </div>
              )}
            </div>
          </div>

          {/* Total comparison */}
          <div className="bg-zinc-800/50 p-3 sm:p-4 rounded-xl">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Ancien Total</p>
                <p className="text-base sm:text-lg font-semibold text-zinc-500">{originalTotal.toFixed(0)}<span className="text-[10px] sm:text-xs ml-1">EUR</span></p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Nouveau Total</p>
                <p className="text-base sm:text-lg font-semibold text-white">{newTotal.toFixed(0)}<span className="text-[10px] sm:text-xs ml-1">EUR</span></p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-zinc-500 mb-1">Difference</p>
                <p className={`text-base sm:text-lg font-semibold ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(0)}<span className="text-[10px] sm:text-xs ml-1">EUR</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Supprimer la commande */}
        <button
          onClick={() => { if (confirm(`Supprimer la commande de ${entry.clientName} (${originalTotal.toFixed(0)} EUR) du recap ?`)) onDelete(entryIndex); }}
          className="w-full mt-4 sm:mt-6 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 py-3 rounded-xl font-semibold uppercase text-xs hover:bg-red-500/20 transition-all border border-red-500/20"
        >
          <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Supprimer cette commande du recap</span><span className="sm:hidden">Supprimer du recap</span>
        </button>

        {/* Actions */}
        <div className="flex gap-3 mt-3 pt-3 sm:pt-4 border-t border-zinc-800/50">
          <button onClick={onClose} className="flex-1 bg-zinc-800/50 text-zinc-400 py-3.5 sm:py-4 rounded-xl font-semibold uppercase text-sm hover:bg-zinc-800 transition-all">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!clientName.trim() || items.filter(i => i.quantity > 0 && i.productName.trim()).length === 0}
            className="flex-1 bg-zinc-800 text-white py-3.5 sm:py-4 rounded-xl font-semibold uppercase text-sm hover:bg-zinc-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditRecapModal;
