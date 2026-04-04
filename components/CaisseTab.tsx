import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import { OrderStatus } from '../src/types';
import type { CaisseData, CreditClient } from '../src/types';
import { generateShortId } from '../src/utils';
import { supabase } from '../supabaseConfig';
import { jsPDF } from 'jspdf';
import {
  Save, Download, Plus, Trash2, Wallet, FileText,
  Users, DollarSign, Receipt, Calendar
} from 'lucide-react';

const formatMoney = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const NumberInput: React.FC<{
  label: string; value: number; onChange: (v: number) => void;
  auto?: boolean; autoValue?: number; onReset?: () => void;
  icon?: React.ReactNode; negative?: boolean;
}> = React.memo(({ label, value, onChange, auto, autoValue, onReset, icon, negative }) => (
  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 sm:p-4">
    <label className="block text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
      {icon}
      {label}
      {auto && <span className="text-[#d4af37] text-[10px] ml-1">AUTO</span>}
      {auto && autoValue !== undefined && value !== autoValue && onReset && (
        <button onClick={onReset} className="text-[9px] text-blue-400 hover:text-blue-300 ml-1 underline">reset</button>
      )}
    </label>
    <input
      type="number"
      inputMode="decimal"
      step="1"
      value={value || ''}
      onChange={e => onChange(Number(e.target.value) || 0)}
      placeholder="0"
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-white text-base sm:text-lg font-bold text-right focus:outline-none focus:border-[#d4af37] transition-colors ${negative ? 'text-red-400' : ''}`}
    />
  </div>
));

const CaisseTab: React.FC = () => {
  const {
    orders, tables, currentEvent, pastEvents, loadCaisse, saveCaisse
  } = useStore(useShallow(state => ({
    orders: state.orders,
    tables: state.tables,
    currentEvent: state.currentEvent,
    pastEvents: state.pastEvents,
    loadCaisse: state.loadCaisse,
    saveCaisse: state.saveCaisse,
  })));

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [vestiaire, setVestiaire] = useState(0);
  const [bar, setBar] = useState(0);
  const [petitBar, setPetitBar] = useState(0);
  const [vuse, setVuse] = useState(0);
  const [nbPax, setNbPax] = useState(0);
  const [noteSoiree, setNoteSoiree] = useState('');
  const [creditClients, setCreditClients] = useState<CreditClient[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [salleOverride, setSalleOverride] = useState<number | null>(null);
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());

  const eventOptions = useMemo(() => {
    const options: { id: string; label: string; isCurrent: boolean }[] = [];
    if (currentEvent) {
      options.push({ id: currentEvent.id, label: `${currentEvent.date} — En cours`, isCurrent: true });
    }
    pastEvents
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(e => {
        options.push({ id: e.id, label: e.date, isCurrent: false });
      });
    return options;
  }, [currentEvent, pastEvents]);

  useEffect(() => {
    if (!selectedEventId && eventOptions.length > 0) {
      setSelectedEventId(eventOptions[0].id);
    }
  }, [eventOptions, selectedEventId]);

  // Charger les statuts "OK" des caisses (flag savedOk dans Supabase)
  useEffect(() => {
    if (eventOptions.length === 0) return;
    const checkSaved = async () => {
      try {
        const { data } = await supabase
          .from('caisses')
          .select('event_id, saved_ok')
          .eq('saved_ok', true);
        const ids = new Set<string>();
        (data || []).forEach(d => {
          if (d.event_id) ids.add(d.event_id);
        });
        setSavedEventIds(ids);
      } catch { /* ignore */ }
    };
    checkSaved();
  }, [eventOptions]);

  const selectedEvent = useMemo(() => {
    if (currentEvent?.id === selectedEventId) return currentEvent;
    return pastEvents.find(e => e.id === selectedEventId);
  }, [selectedEventId, currentEvent, pastEvents]);

  const isCurrentEvent = currentEvent?.id === selectedEventId;

  // CA automatique — toutes les commandes servies = Salle
  const caSalle = useMemo(() => {
    if (isCurrentEvent) {
      return orders
        .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
        .reduce((sum, o) => sum + o.totalAmount, 0);
    }
    if (selectedEvent?.detailedHistory) {
      return selectedEvent.detailedHistory.reduce((sum, entry) => sum + entry.totalAmount, 0);
    }
    return 0;
  }, [isCurrentEvent, orders, selectedEvent]);

  const effectiveSalle = salleOverride !== null ? salleOverride : caSalle;

  const ttc = useMemo(() => vestiaire + effectiveSalle + bar + petitBar + vuse, [vestiaire, effectiveSalle, bar, petitBar, vuse]);
  const ht = useMemo(() => ttc / 1.2, [ttc]);
  const totalCredits = useMemo(() => creditClients.reduce((sum, c) => sum + c.amount, 0), [creditClients]);

  useEffect(() => {
    if (!selectedEventId) return;
    setIsLoaded(false);
    loadCaisse(selectedEventId).then(data => {
      if (data) {
        setVestiaire(data.vestiaire || 0);
        setBar(data.bar || 0);
        setPetitBar(data.petitBar || 0);
        setVuse(data.vuse || 0);
        setNbPax(data.nbPax || 0);
        setNoteSoiree(data.noteSoiree || '');
        setCreditClients(data.creditClients || []);
        setSalleOverride(data.salleOverride ?? null);
      } else {
        setVestiaire(0); setBar(0); setPetitBar(0); setVuse(0); setNbPax(0);
        setNoteSoiree(''); setCreditClients([]);
        setSalleOverride(null);
      }
      setIsLoaded(true);
      setLastSaved(null);
    });
  }, [selectedEventId, loadCaisse]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    await saveCaisse({
      vestiaire, caSalle: effectiveSalle, bar, petitBar, vuse,
      ttc, ht, nbPax, noteSoiree, creditClients, salleOverride, savedOk: true,
    }, selectedEventId);
    setLastSaved(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setSavedEventIds(prev => new Set(prev).add(selectedEventId));
    setIsSaving(false);
  }, [vestiaire, effectiveSalle, bar, petitBar, vuse, ttc, ht, nbPax, noteSoiree, creditClients, saveCaisse, isSaving, selectedEventId, salleOverride]);

  const handleAddCredit = useCallback(() => {
    setCreditClients(prev => [...prev, { id: generateShortId('credit'), lastName: '', firstName: '', amount: 0 }]);
  }, []);

  const handleUpdateCredit = useCallback((id: string, field: keyof CreditClient, value: string | number) => {
    setCreditClients(prev => prev.map(c =>
      c.id === id ? { ...c, [field]: field === 'amount' ? Number(value) || 0 : String(value).toUpperCase() } : c
    ));
  }, []);

  const handleRemoveCredit = useCallback((id: string) => {
    setCreditClients(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleGeneratePDF = useCallback(() => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const cx = pw / 2;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("DEFLOWER CLUB", cx, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("RECAP CAISSE", cx, y, { align: "center" });
    y += 6;
    doc.setFontSize(9);
    doc.text(`Soiree du ${selectedEvent?.date || '-'} - Edite le ${new Date().toLocaleDateString('fr-FR')}`, cx, y, { align: "center" });
    y += 10;
    doc.setLineWidth(0.5);
    doc.line(20, y, pw - 20, y);
    y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CHIFFRE D'AFFAIRES", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    [
      ['Salle (Club)', `${effectiveSalle.toFixed(0)} EUR`],
      ['Bar', `${bar.toFixed(0)} EUR`],
      ['Petit Bar', `${petitBar.toFixed(0)} EUR`],
      ['Vuse', `${vuse.toFixed(0)} EUR`],
      ['Vestiaire', `${vestiaire.toFixed(0)} EUR`],
    ].forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value, pw - 25, y, { align: "right" });
      y += 7;
    });

    y += 3;
    doc.setLineWidth(0.3);
    doc.line(20, y, pw - 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("NB DE PAX", 25, y);
    doc.text(`${nbPax}`, pw - 25, y, { align: "right" });
    y += 10;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL TTC", 25, y);
    doc.text(`${ttc.toFixed(0)} EUR`, pw - 25, y, { align: "right" });
    y += 8;
    doc.setFontSize(11);
    doc.text("TOTAL HT (- 20%)", 25, y);
    doc.text(`${ht.toFixed(0)} EUR`, pw - 25, y, { align: "right" });
    y += 12;

    doc.setLineWidth(0.5);
    doc.line(20, y, pw - 20, y);
    y += 10;

    if (creditClients.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("CREDITS CLIENTS", 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      creditClients.forEach(c => {
        doc.text(`${c.lastName} ${c.firstName}`, 25, y);
        doc.text(`${c.amount.toFixed(0)} EUR`, pw - 25, y, { align: "right" });
        y += 7;
      });
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Total credits", 25, y);
      doc.text(`${totalCredits.toFixed(0)} EUR`, pw - 25, y, { align: "right" });
      y += 12;
      doc.setLineWidth(0.3);
      doc.line(20, y, pw - 20, y);
      y += 10;
    }

    if (noteSoiree.trim()) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("NOTE DE SOIREE", 20, y);
      y += 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(noteSoiree, pw - 50);
      doc.text(lines, 25, y);
      y += lines.length * 5 + 5;
    }

    y += 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Document de gestion interne - Deflower Club", cx, y, { align: "center" });

    doc.save(`Caisse_${selectedEvent?.date || 'soiree'}.pdf`);
  }, [vestiaire, effectiveSalle, bar, petitBar, vuse, ttc, ht, nbPax, noteSoiree, creditClients, totalCredits, selectedEvent]);

  if (eventOptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <Wallet className="w-12 h-12 mb-4 opacity-40" />
        <p className="text-sm font-medium">Aucune soiree disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white uppercase flex items-center gap-2">
          <Wallet className="w-5 h-5 text-[#d4af37]" />
          Caisse
        </h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {lastSaved && <span className="text-[10px] text-white/30 shrink-0">Sauve a {lastSaved}</span>}
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1.5 bg-[#d4af37] hover:bg-[#b8860b] text-[#1a0a0a] px-4 py-2 rounded-lg font-bold text-xs uppercase transition-colors disabled:opacity-50 shrink-0">
            <Save className="w-4 h-4" /> {isSaving ? '...' : 'Sauver'}
          </button>
          <button onClick={handleGeneratePDF}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase transition-colors shrink-0">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" /> Soiree
        </label>
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          className="w-full bg-[#141414] border border-white/10 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-[#d4af37] transition-colors">
          {eventOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}{savedEventIds.has(opt.id) ? ' - OK' : ''}</option>)}
        </select>
      </div>

      {!isLoaded ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <NumberInput
            label="Salle (Club)" value={effectiveSalle} auto autoValue={caSalle}
            onChange={v => setSalleOverride(v)} onReset={() => setSalleOverride(null)}
            icon={<DollarSign className="w-3 h-3" />}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Bar" value={bar} onChange={setBar} icon={<Receipt className="w-3 h-3" />} />
            <NumberInput label="Petit Bar" value={petitBar} onChange={setPetitBar} icon={<Receipt className="w-3 h-3" />} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Vuse" value={vuse} onChange={setVuse} icon={<Receipt className="w-3 h-3" />} />
            <NumberInput label="Vestiaire" value={vestiaire} onChange={setVestiaire} icon={<Receipt className="w-3 h-3" />} />
          </div>

          <NumberInput label="Nb de PAX" value={nbPax} onChange={setNbPax} icon={<Users className="w-3 h-3" />} />

          <div className="bg-white/[0.05] border border-[#d4af37]/30 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs sm:text-sm font-bold text-white/60 uppercase shrink-0">Total TTC</span>
              <span className="text-2xl sm:text-3xl font-black text-[#d4af37] text-right break-all">{formatMoney(ttc)} EUR</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
              <span className="text-xs sm:text-sm font-bold text-white/40 uppercase shrink-0">Total HT (-20%)</span>
              <span className="text-lg sm:text-xl font-bold text-white/60 text-right break-all">{formatMoney(ht)} EUR</span>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Note de soiree
            </label>
            <textarea value={noteSoiree} onChange={e => setNoteSoiree(e.target.value)}
              placeholder="Comment s'est passee la soiree, problemes, remarques..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#d4af37] transition-colors resize-none" />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Credits Clients
                {totalCredits > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-400 font-bold">{totalCredits.toFixed(0)}EUR</span>
                )}
              </label>
              <button onClick={handleAddCredit}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition-colors">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            {creditClients.length === 0 ? (
              <p className="text-center text-white/20 text-xs py-6">Aucun credit client</p>
            ) : (
              <div className="space-y-2">
                {creditClients.map(credit => (
                  <div key={credit.id} className="flex items-center gap-2">
                    <input value={credit.lastName} onChange={e => handleUpdateCredit(credit.id, 'lastName', e.target.value)}
                      placeholder="NOM" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm uppercase focus:outline-none focus:border-[#d4af37]" />
                    <input value={credit.firstName} onChange={e => handleUpdateCredit(credit.id, 'firstName', e.target.value)}
                      placeholder="PRENOM" className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm uppercase focus:outline-none focus:border-[#d4af37]" />
                    <input type="number" inputMode="decimal" value={credit.amount || ''} onChange={e => handleUpdateCredit(credit.id, 'amount', e.target.value)}
                      placeholder="0" className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm text-right font-bold focus:outline-none focus:border-[#d4af37]" />
                    <button onClick={() => handleRemoveCredit(credit.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CaisseTab;
