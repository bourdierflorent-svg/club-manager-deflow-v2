import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseConfig';
import { HubCustomer } from '../src/types';
import {
  Search, RefreshCw, ChevronRight, UserPlus, Loader2, X,
  Phone, Calendar, StickyNote, MapPin, Send, Trash, TrendingUp, Pencil, Save, XCircle,
} from 'lucide-react';
import { createHubCustomerAuto } from '../src/utils';
import { useStore } from '../store/index';

const TAG_CONFIG: Record<string, { label: string; color: string }> = {
  vip:       { label: 'VIP',          color: 'text-[#d4af37] bg-[#d4af37]/10 border-[#d4af37]/30' },
  regular:   { label: 'Régulier',     color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  blacklist: { label: 'Blacklist',    color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  watchlist: { label: 'Surveillance', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
};

const CLUB_LABELS: Record<string, string> = {
  ClubA: 'Little Room',
  ClubB: 'Deflower',
  ClubC: 'Giulia',
};

const CLUB_COLORS: Record<string, string> = {
  ClubA: '#3b82f6',
  ClubB: '#d946ef',
  ClubC: '#10b981',
};

interface HubVisitItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

interface HubVisit {
  id: string;
  clubId: string;
  clubName: string;
  amount: number;
  visitDate: any;
  items?: HubVisitItem[];
}

interface HubNote {
  id: string;
  content: string;
  authorName: string;
  clubId: string | null;
  createdAt: any;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '\u2014';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Map a Supabase customers row to a HubCustomer object */
function rowToHubCustomer(row: any): HubCustomer {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    nickname: row.nickname ?? null,
    displayName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    displayNameSearch: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim().toLowerCase(),
    phone: row.phone ?? null,
    email: row.email ?? null,
    birthDate: row.birth_date ?? null,
    notes: row.notes ?? null,
    createdByName: row.created_by_name ?? null,
    tags: row.tags ?? [],
    totalVisits: row.total_visits ?? 0,
    totalRevenue: row.total_revenue ?? 0,
    vipScore: row.vip_score ?? 0,
  };
}

// ============================================
// DETAIL VIEW
// ============================================

const CustomerDetailView: React.FC<{
  customer: HubCustomer;
  onBack: () => void;
  onUpdated: () => void;
}> = ({ customer, onBack, onUpdated }) => {
  const currentUser = useStore(state => state.currentUser);
  const [visits, setVisits] = useState<HubVisit[]>([]);
  const [notes, setNotes] = useState<HubNote[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    nickname: customer.nickname || '',
    phone: customer.phone || '',
    birthDate: customer.birthDate || '',
    notes: customer.notes || '',
  });

  const handleSaveEdit = async () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editForm.firstName.trim(),
          last_name: editForm.lastName.trim(),
          phone: editForm.phone.trim() || null,
          email: customer.email,
        })
        .eq('id', customer.id);
      if (error) throw error;
      setEditing(false);
      onUpdated();
    } catch (err) {
      console.error('[HubDetail] edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditForm({
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      nickname: customer.nickname || '',
      phone: customer.phone || '',
      birthDate: customer.birthDate || '',
      notes: customer.notes || '',
    });
    setEditing(false);
  };

  const loadVisits = useCallback(async () => {
    setLoadingVisits(true);
    try {
      // No visits table in Supabase yet — stub
      console.log('[HubDetail] visits: no Supabase visits table yet');
      setVisits([]);
    } catch (err: any) {
      console.error('[HubDetail] visits error:', err.message);
    } finally {
      setLoadingVisits(false);
    }
  }, [customer.id]);

  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      // No notes table in Supabase yet — stub
      console.log('[HubDetail] notes: no Supabase notes table yet');
      setNotes([]);
    } catch (err) {
      console.warn('[HubDetail] notes error:', err);
    } finally {
      setLoadingNotes(false);
    }
  }, [customer.id]);

  useEffect(() => {
    loadVisits();
    loadNotes();
  }, [loadVisits, loadNotes]);

  const handleAddNote = async () => {
    if (!noteText.trim() || addingNote) return;
    setAddingNote(true);
    try {
      // No notes table in Supabase yet — stub
      console.log('[HubDetail] addNote stub:', noteText);
      setNoteText('');
    } catch (err) {
      console.error('[HubDetail] add note error:', err);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      // No notes table in Supabase yet — stub
      console.log('[HubDetail] deleteNote stub:', noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('[HubDetail] delete note error:', err);
    }
  };

  // Compute KPIs from actual visits subcollection (more accurate than stale customer doc)
  const liveVisitCount = !loadingVisits ? visits.length : customer.totalVisits;
  const liveRevenue = !loadingVisits
    ? visits.reduce((sum, v) => sum + (v.amount || 0), 0)
    : customer.totalRevenue;
  const avgBasket = liveVisitCount > 0
    ? Math.round(liveRevenue / liveVisitCount)
    : 0;

  // Compute top 5 bottles across all visits (exclude Redbull)
  const topBottles = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of visits) {
      if (!v.items) continue;
      for (const item of v.items) {
        if (item.productName.toLowerCase().includes('redbull') || item.productName.toLowerCase().includes('red bull')) continue;
        counts[item.productName] = (counts[item.productName] || 0) + item.quantity;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));
  }, [visits]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-2"
      >
        ← Retour à la liste
      </button>

      {/* Profile card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#d4af37] to-[#b8860b] flex items-center justify-center text-lg font-black text-[#1a0a0a] flex-shrink-0">
            {(editing ? editForm.firstName : customer.firstName)?.[0]?.toUpperCase() ?? ''}
            {(editing ? editForm.lastName : customer.lastName)?.[0]?.toUpperCase() ?? ''}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{editing ? [editForm.firstName, editForm.lastName].filter(Boolean).join(' ') || customer.displayName : customer.displayName}</h2>
            {!editing && customer.nickname && (
              <p className="text-sm text-white/40 mt-0.5">"{customer.nickname}"</p>
            )}
            {/* ID masqué */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {customer.tags.map(t => (
                <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TAG_CONFIG[t]?.color ?? ''}`}>
                  {TAG_CONFIG[t]?.label ?? t}
                </span>
              ))}
              {customer.createdByName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border text-emerald-400 bg-emerald-400/10 border-emerald-400/30">
                  par {customer.createdByName}
                </span>
              )}
            </div>
          </div>
          {/* Edit / VIP Score */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
                >
                  <XCircle size={13} /> Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editForm.firstName.trim() || !editForm.lastName.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Sauvegarder
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-white/40 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
              >
                <Pencil size={12} /> Modifier
              </button>
            )}
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Score VIP</p>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#b8860b]"
                    style={{ width: `${customer.vipScore}%` }}
                  />
                </div>
                <span className="text-lg font-bold font-mono text-[#d4af37]">{customer.vipScore}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact + KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Informations</h3>
          {editing ? (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Prénom *</label>
                <input
                  value={editForm.firstName}
                  onChange={e => setEditForm(p => ({ ...p, firstName: e.target.value }))}
                  placeholder="Prénom"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Nom *</label>
                <input
                  value={editForm.lastName}
                  onChange={e => setEditForm(p => ({ ...p, lastName: e.target.value }))}
                  placeholder="Nom"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Surnom</label>
                <input
                  value={editForm.nickname}
                  onChange={e => setEditForm(p => ({ ...p, nickname: e.target.value }))}
                  placeholder="Optionnel"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Téléphone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+33 6..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Date anniversaire</label>
                <input
                  type="date"
                  value={editForm.birthDate}
                  onChange={e => setEditForm(p => ({ ...p, birthDate: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Note de fiche</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Note libre..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors resize-none"
                />
              </div>
            </div>
          ) : (
            <>
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-white/30" />
                  <span className="text-sm text-white/70">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs">@</span>
                  <span className="text-sm text-white/70">{customer.email}</span>
                </div>
              )}
              {customer.birthDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-white/30" />
                  <span className="text-sm text-white/70">{customer.birthDate}</span>
                </div>
              )}
              {!customer.phone && !customer.email && !customer.birthDate && (
                <p className="text-xs text-white/20 italic">Aucune info de contact</p>
              )}
            </>
          )}
        </div>

        {/* KPIs */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3">Chiffres clés</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-[9px] text-white/30 uppercase">CA Total</p>
              <p className="text-base font-bold text-[#d4af37]">{liveRevenue.toLocaleString('fr-FR')} €</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <p className="text-[9px] text-white/30 uppercase">Panier moyen</p>
              <p className="text-base font-bold text-white">{avgBasket.toLocaleString('fr-FR')} €</p>
            </div>
          </div>
          {/* Top 5 bouteilles */}
          <p className="text-[9px] text-white/30 uppercase mb-2">Top 5 bouteilles</p>
          {topBottles.length > 0 ? (
            <div className="space-y-1">
              {topBottles.map((b, i) => (
                <div key={b.name} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                  <span className="text-xs text-white/70 truncate">
                    <span className="text-white/30 font-mono mr-1.5">{i + 1}.</span>
                    {b.name}
                  </span>
                  <span className="text-xs font-bold text-[#d4af37] ml-2 shrink-0">x{b.qty}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/20 italic">Aucune bouteille</p>
          )}
        </div>
      </div>


      {/* Notes + Visits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Notes */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <StickyNote size={12} /> Notes {notes.length > 0 && <span className="text-white/20">({notes.length})</span>}
          </h3>

          {/* Add note */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
              placeholder="Ajouter une note..."
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
            />
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim() || addingNote}
              className="p-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/20 transition-all disabled:opacity-30"
            >
              {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          {/* Notes list */}
          {loadingNotes ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="animate-pulse p-3 rounded-xl bg-white/5">
                  <div className="h-3 bg-white/5 rounded w-20 mb-2" />
                  <div className="h-4 bg-white/5 rounded w-full" />
                </div>
              ))}
            </div>
          ) : notes.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notes.map(note => (
                <div key={note.id} className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/20 font-mono">{formatTimestamp(note.createdAt)}</span>
                      {note.clubId && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${CLUB_COLORS[note.clubId] || '#3b82f6'}15`,
                            color: CLUB_COLORS[note.clubId] || '#3b82f6',
                          }}
                        >
                          {CLUB_LABELS[note.clubId] || note.clubId}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-0.5 rounded hover:bg-white/10 text-white/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                  <p className="text-sm text-white/70">{note.content}</p>
                  <p className="text-[10px] text-white/20 mt-1">{note.authorName}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/20 italic text-center py-4">Aucune note</p>
          )}
        </div>

        {/* Visits */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MapPin size={12} /> Historique des visites {visits.length > 0 && <span className="text-white/20">({visits.length})</span>}
          </h3>

          {loadingVisits ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse p-3 rounded-xl bg-white/5">
                  <div className="h-4 bg-white/5 rounded w-full" />
                </div>
              ))}
            </div>
          ) : visits.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {visits.map((visit, idx) => {
                const clubColor = CLUB_COLORS[visit.clubId] || '#3b82f6';
                const clubLabel = CLUB_LABELS[visit.clubId] || visit.clubName || visit.clubId;
                return (
                  <div key={visit.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${idx === 0 ? 'ring-1 ring-[#d4af37]/20' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/30">{formatTimestamp(visit.visitDate)}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                        style={{ backgroundColor: `${clubColor}20`, color: clubColor }}
                      >
                        {clubLabel}
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-[#d4af37]">{(visit.amount || 0).toLocaleString('fr-FR')} €</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <MapPin size={20} className="mx-auto text-white/10 mb-2" />
              <p className="text-xs text-white/20">Aucune visite enregistrée</p>
            </div>
          )}
        </div>
      </div>

      {/* Note de fiche */}
      {customer.notes && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Note de fiche</p>
          <p className="text-sm text-white/60">{customer.notes}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const HubClientsPage: React.FC = () => {
  const currentUser = useStore(state => state.currentUser);
  const [allCustomers, setAllCustomers] = useState<HubCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selected, setSelected] = useState<HubCustomer | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ lastName: '', firstName: '', phone: '', birthDate: '', notes: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreateClient = async () => {
    if (!createForm.lastName.trim() || !createForm.firstName.trim() || !createForm.phone.trim()) {
      setCreateError('Nom, prénom et téléphone sont obligatoires.');
      return;
    }
    setIsCreating(true);
    setCreateError('');
    try {
      const creatorName = currentUser?.firstName || currentUser?.lastName || 'Inconnu';
      await createHubCustomerAuto({
        lastName: createForm.lastName.trim(),
        firstName: createForm.firstName.trim(),
        phone: createForm.phone.trim(),
        birthDate: createForm.birthDate.trim() || null,
        notes: createForm.notes.trim() || null,
        createdByName: creatorName,
      });
      setCreateForm({ lastName: '', firstName: '', phone: '', birthDate: '', notes: '' });
      setShowCreateForm(false);
      await loadAll();
    } catch (err: any) {
      setCreateError(`Erreur : ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;

      setAllCustomers((data ?? []).map(rowToHubCustomer));
    } catch (err: any) {
      console.warn('[HubClients] Fetch error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Keep selected customer in sync after reload
  useEffect(() => {
    if (selected) {
      const updated = allCustomers.find(c => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [allCustomers]);

  const filtered = useMemo(() => {
    let list = allCustomers;
    if (tagFilter) {
      list = list.filter(c => c.tags?.includes(tagFilter));
    }
    if (searchTerm.trim().length >= 2) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(c =>
        c.displayName?.toLowerCase().includes(term) ||
        c.nickname?.toLowerCase().includes(term) ||
        c.id?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [allCustomers, searchTerm, tagFilter]);

  // Detail view
  if (selected) {
    return <CustomerDetailView customer={selected} onBack={() => setSelected(null)} onUpdated={async () => { await loadAll(); }} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0 flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          </div>
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Tous</option>
            <option value="vip">VIP</option>
            <option value="regular">Réguliers</option>
            <option value="blacklist">Blacklist</option>
            <option value="watchlist">Surveillance</option>
          </select>
          <button
            onClick={() => loadAll()}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase transition-colors"
          >
            <UserPlus size={14} /> Créer
          </button>
        </div>
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UserPlus size={14} className="text-[#d4af37]" /> Créer fiche client
            </h3>
            <button onClick={() => { setShowCreateForm(false); setCreateError(''); }} className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white">
              <X size={14} />
            </button>
          </div>
          {createError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{createError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Nom *</label>
              <input
                value={createForm.lastName}
                onChange={e => setCreateForm(p => ({ ...p, lastName: e.target.value }))}
                placeholder="NOM"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white uppercase placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Prénom *</label>
              <input
                value={createForm.firstName}
                onChange={e => setCreateForm(p => ({ ...p, firstName: e.target.value }))}
                placeholder="PRÉNOM"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white uppercase placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Téléphone *</label>
            <input
              value={createForm.phone}
              onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+33 6..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Date anniversaire</label>
            <input
              type="date"
              value={createForm.birthDate}
              onChange={e => setCreateForm(p => ({ ...p, birthDate: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/40 mb-1 uppercase tracking-wider">Note</label>
            <textarea
              value={createForm.notes}
              onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Note libre..."
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4af37] transition-colors resize-none"
            />
          </div>
          {currentUser && (
            <p className="text-[10px] text-white/30">
              Créé par : <span className="text-[#d4af37] font-semibold">{currentUser.firstName || currentUser.lastName}</span>
            </p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => { setShowCreateForm(false); setCreateError(''); }}
              className="px-4 py-2 text-sm text-white/50 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateClient}
              disabled={isCreating || !createForm.lastName.trim() || !createForm.firstName.trim() || !createForm.phone.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 uppercase"
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
        {isLoading && allCustomers.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">Aucun client trouvé</div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="w-full text-left px-4 py-3.5 hover:bg-white/[0.03] transition-colors flex items-center gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white group-hover:text-[#d4af37] transition-colors">
                      {c.displayName}
                    </p>
                    {c.nickname && (
                      <p className="text-xs text-white/30">"{c.nickname}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {c.tags.map(t => (
                      <span key={t} className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${TAG_CONFIG[t]?.color ?? ''}`}>
                        {TAG_CONFIG[t]?.label ?? t}
                      </span>
                    ))}
                    {c.createdByName && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold border text-emerald-400 bg-emerald-400/10 border-emerald-400/30">
                        par {c.createdByName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-white/40">{c.totalVisits} visite{c.totalVisits > 1 ? 's' : ''}</p>
                  <p className="text-xs font-bold text-[#d4af37]">{c.totalRevenue.toLocaleString('fr-FR')} €</p>
                </div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-[#d4af37] shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compteur */}
      <p className="text-[10px] text-white/20 text-right">
        {filtered.length} client{filtered.length > 1 ? 's' : ''} sur {allCustomers.length}
      </p>
    </div>
  );
};

export default HubClientsPage;
