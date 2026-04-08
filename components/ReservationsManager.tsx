/**
 * ReservationsManager.tsx
 * Gestionnaire de réservations avec vue calendrier
 * - Vue calendrier mensuelle
 * - Clic sur une date -> modal de création/liste
 * - Affichage du créateur de la réservation
 * - Export PDF des réservations
 * - Récap des réservations passées (confirmées / non confirmées)
 * - Accès même pendant la soirée
 */

import React, { useState, useMemo } from 'react';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import {
  ReservationStatus,
  Reservation,
  OrderStatus,
  RESERVATION_STATUS_CONFIG,
  normalizeReservationStatus,
  HubCustomerSnapshot
} from '../src/types';
import {
  Calendar, Plus, X, Users, Phone, FileText,
  Trash2, Edit3, ChevronLeft, ChevronRight,
  UserCircle, Clock, AlertCircle, Download,
  CheckCircle2, Eye
} from 'lucide-react';
import { ReservationStatusDropdown } from './ui';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useHubCustomerSearch } from '../src/hooks/useHubCustomerSearch';
import { useHubApporteurSearch } from '../src/hooks/useHubApporteurSearch';
import { createHubCustomerAuto } from '../src/utils/hubCustomerCreator';
import { createHubApporteurAuto } from '../src/utils/hubApporteurCreator';
import type { HubCustomer, HubApporteur, HubApporteurSnapshot } from '../src/types';

// ============================================
// HELPERS
// ============================================

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 7 : day;
};

const formatDateKey = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

interface ReservationsManagerProps {
  readOnly?: boolean; // Pour le mode Viewer
  canForceDelete?: boolean; // Gérant peut supprimer même les résas confirmées/venues
}

const ReservationsManager: React.FC<ReservationsManagerProps> = ({ readOnly = false, canForceDelete = false }) => {
  const {
    reservations,
    allReservations,
    createReservation,
    updateReservation,
    markReservationArrived,
    markReservationRefused,
    markReservationNoShow,
    deleteReservation,
    currentEvent,
    clients,
    orders
  } = useStore(useShallow(state => ({
    reservations: state.reservations, allReservations: state.allReservations,
    createReservation: state.createReservation, updateReservation: state.updateReservation,
    markReservationArrived: state.markReservationArrived,
    markReservationRefused: state.markReservationRefused,
    markReservationNoShow: state.markReservationNoShow, deleteReservation: state.deleteReservation,
    currentEvent: state.currentEvent, clients: state.clients, orders: state.orders,
  })));

  // État du calendrier
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Date sélectionnée et modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [showRecapModal, setShowRecapModal] = useState(false);

  // Formulaire
  const [formData, setFormData] = useState({
    clientLastName: '',
    clientFirstName: '',
    nickname: '',
    numberOfGuests: '' as number | '',
    phoneNumber: '',
    businessProvider: '',
    notes: ''
  });
  const [hubCustomerId, setHubCustomerId] = useState<string | null>(null);
  const [hubSnapshot, setHubSnapshot] = useState<HubCustomerSnapshot | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const { results: hubResults, isLoading: hubSearching, search: hubSearch, clear: hubClear } = useHubCustomerSearch();
  const { results: apporteurResults, isLoading: searchingApporteur, search: searchApporteur, clear: clearApporteur } = useHubApporteurSearch();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const apporteurDebounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const formWrapperRef = React.useRef<HTMLDivElement>(null);
  const [apporteurId, setApporteurId] = useState<string | null>(null);
  const [apporteurSnapshot, setApporteurSnapshot] = useState<HubApporteurSnapshot | null>(null);
  const [showApporteurSuggestions, setShowApporteurSuggestions] = useState(false);

  const TAG_EMOJI: Record<string, string> = {
    vip: '\u2b50', blacklist: '\ud83d\udeab', watchlist: '\u26a0\ufe0f', regular: '\u2713',
  };

  React.useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (formWrapperRef.current && !formWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setShowApporteurSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const triggerHubSearch = (value: string) => {
    clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      setShowSuggestions(true);
      debounceRef.current = setTimeout(() => hubSearch(value), 250);
    } else {
      setShowSuggestions(false);
      hubClear();
    }
  };

  const handleFieldChange = (field: string, value: string, uppercase = true) => {
    const val = uppercase ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [field]: val }));
    if (hubCustomerId) { setHubCustomerId(null); setHubSnapshot(null); }
    const searchableFields = ['clientFirstName', 'clientLastName', 'nickname', 'phoneNumber'];
    if (searchableFields.includes(field)) {
      setActiveField(field);
      triggerHubSearch(value);
    }
  };

  const handleSelectHubCustomer = (c: HubCustomer) => {
    setFormData(prev => ({
      ...prev,
      clientFirstName: (c.firstName || '').toUpperCase(),
      clientLastName: (c.lastName || '').toUpperCase(),
      nickname: (c.nickname || '').toUpperCase(),
      phoneNumber: c.phone || prev.phoneNumber,
    }));
    setHubCustomerId(c.id);
    setHubSnapshot({
      customerId: c.id,
      displayName: c.displayName,
      nickname: c.nickname,
      tags: c.tags,
      vipScore: c.vipScore,
    });
    setShowSuggestions(false);
    hubClear();
  };

  const handleApporteurChange = (value: string) => {
    setFormData(prev => ({ ...prev, businessProvider: value.toUpperCase() }));
    if (apporteurId) { setApporteurId(null); setApporteurSnapshot(null); }
    clearTimeout(apporteurDebounceRef.current);
    if (value.trim().length >= 2) {
      setShowApporteurSuggestions(true);
      apporteurDebounceRef.current = setTimeout(() => searchApporteur(value), 250);
    } else {
      setShowApporteurSuggestions(false);
      clearApporteur();
    }
  };

  const handleSelectApporteur = (a: HubApporteur) => {
    setFormData(prev => ({ ...prev, businessProvider: a.name }));
    setApporteurId(a.id);
    setApporteurSnapshot({ apporteurId: a.id, name: a.name });
    setShowApporteurSuggestions(false);
    clearApporteur();
  };

  const handleCreateApporteur = async (typedName: string) => {
    try {
      const result = await createHubApporteurAuto({ name: typedName });
      setApporteurId(result.apporteurId);
      setApporteurSnapshot(result.snapshot);
      setShowApporteurSuggestions(false);
      clearApporteur();
    } catch (err) {
      console.error('[WARN] Hub apporteur auto-create failed:', err);
    }
  };

  // ============================================
  // DONNÉES DÉRIVÉES
  // ============================================

  // Utiliser allReservations pour avoir tout l'historique
  const allResasForDisplay = allReservations || reservations;

  // Compter les réservations par date pour le mois actuel (toutes les résas)
  const reservationsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    allResasForDisplay.forEach(r => {
      if (!counts[r.date]) counts[r.date] = 0;
      counts[r.date]++;
    });
    return counts;
  }, [allResasForDisplay]);

  // Réservations pour la date sélectionnée
  const selectedDateReservations = useMemo(() => {
    if (!selectedDate) return [];
    return allResasForDisplay
      .filter(r => r.date === selectedDate)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }, [allResasForDisplay, selectedDate]);

  // Stats du mois (avec normalisation pour compatibilité)
  const monthStats = useMemo(() => {
    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const monthReservations = allResasForDisplay.filter(r => r.date.startsWith(monthPrefix));
    return {
      total: monthReservations.length,
      totalGuests: monthReservations.reduce((acc, r) => acc + (r.numberOfGuests || 1), 0),
      enAttente: monthReservations.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.EN_ATTENTE).length,
      venu: monthReservations.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.VENU).length,
      confirme: monthReservations.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.CONFIRME).length,
      noShow: monthReservations.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.NO_SHOW).length,
      recale: monthReservations.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.RECALE).length
    };
  }, [allResasForDisplay, currentMonth, currentYear]);

  // Récap des réservations du jour (pour la soirée)
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const todayReservationsRecap = useMemo(() => {
    return allResasForDisplay.filter(r => r.date === todayKey);
  }, [allResasForDisplay, todayKey]);

  // Trouver le client associé à une réservation convertie
  const getClientForReservation = (reservationId: string) => {
    return clients.find(c => c.reservationId === reservationId);
  };

  // Calculer le vrai total d'un client (commandes servies ou totalSpent si réglé)
  const getClientTotal = (clientId: string, totalSpent: number, status: string) => {
    if (status === 'closed') return totalSpent;
    return orders
      .filter(o => o.clientId === clientId && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
      .reduce((acc, o) => acc + o.totalAmount, 0);
  };

  // ============================================
  // ACTIONS
  // ============================================

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(y => y - 1);
      } else {
        setCurrentMonth(m => m - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(y => y + 1);
      } else {
        setCurrentMonth(m => m + 1);
      }
    }
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
  };

  const openNewModal = () => {
    setEditingReservation(null);
    setFormData({
      clientLastName: '',
      clientFirstName: '',
      nickname: '',
      numberOfGuests: '',
      phoneNumber: '',
      businessProvider: '',
      notes: ''
    });
    setShowSuggestions(false);
    setHubCustomerId(null);
    setHubSnapshot(null);
    setApporteurId(null);
    setApporteurSnapshot(null);
    setShowApporteurSuggestions(false);
    setShowModal(true);
  };

  const openEditModal = (reservation: any) => {
    setEditingReservation(reservation);
    // Séparer le nom existant en prénom/nom (le premier mot est le prénom, le reste le nom)
    const parts = (reservation.clientName || '').split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    setFormData({
      clientLastName: lastName,
      clientFirstName: firstName,
      nickname: reservation.nickname || '',
      numberOfGuests: reservation.numberOfGuests || '',
      phoneNumber: reservation.phoneNumber || '',
      businessProvider: reservation.businessProvider || '',
      notes: reservation.notes || ''
    });
    setShowSuggestions(false);
    setHubCustomerId(reservation.customerId || null);
    setHubSnapshot(reservation.customerSnapshot || null);
    setApporteurId(reservation.apporteurId || null);
    setApporteurSnapshot(reservation.apporteurSnapshot || null);
    setShowApporteurSuggestions(false);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.clientLastName.trim() || !formData.clientFirstName.trim() || !selectedDate || !formData.numberOfGuests || !formData.businessProvider.trim()) return;

    const clientName = `${formData.clientFirstName.trim()} ${formData.clientLastName.trim()}`.toUpperCase();
    const { clientLastName, clientFirstName, nickname, ...restFormData } = formData;

    // Auto-create Hub customer if not already linked
    let finalHubCustomerId = hubCustomerId;
    let finalHubSnapshot = hubSnapshot;
    if (!finalHubCustomerId) {
      try {
        const result = await createHubCustomerAuto({
          lastName: formData.clientLastName.trim(),
          firstName: formData.clientFirstName.trim(),
          nickname: formData.nickname?.trim() || null,
          phone: formData.phoneNumber?.trim() || null,
        });
        finalHubCustomerId = result.customerId;
        finalHubSnapshot = result.snapshot;
      } catch (err) {
        console.error('[WARN] Hub auto-create failed (non-blocking):', err);
      }
    }

    // Auto-create Hub apporteur if not already linked
    let finalApporteurId = apporteurId;
    let finalApporteurSnapshot = apporteurSnapshot;
    if (!finalApporteurId && formData.businessProvider.trim()) {
      try {
        const appResult = await createHubApporteurAuto({ name: formData.businessProvider.trim() });
        finalApporteurId = appResult.apporteurId;
        finalApporteurSnapshot = appResult.snapshot;
      } catch (err) {
        console.error('[WARN] Hub apporteur auto-create failed (non-blocking):', err);
      }
    }

    const extraData: Record<string, any> = {};
    if (nickname.trim()) extraData.nickname = nickname.trim().toUpperCase();
    if (finalHubCustomerId) extraData.customerId = finalHubCustomerId;
    if (finalHubSnapshot) extraData.customerSnapshot = finalHubSnapshot;
    if (finalApporteurId) extraData.apporteurId = finalApporteurId;
    if (finalApporteurSnapshot) extraData.apporteurSnapshot = finalApporteurSnapshot;

    const guestCount = Number(restFormData.numberOfGuests) || 1;

    if (editingReservation) {
      await updateReservation(editingReservation.id, {
        ...restFormData,
        ...extraData,
        numberOfGuests: guestCount,
        clientName,
        date: selectedDate
      });
    } else {
      await createReservation({
        ...restFormData,
        ...extraData,
        numberOfGuests: guestCount,
        clientName,
        date: selectedDate,
        time: ''
      });
    }

    setShowModal(false);
    setFormData({
      clientLastName: '',
      clientFirstName: '',
      nickname: '',
      numberOfGuests: '',
      phoneNumber: '',
      businessProvider: '',
      notes: ''
    });
    setShowSuggestions(false);
    setHubCustomerId(null);
    setHubSnapshot(null);
    setApporteurId(null);
    setApporteurSnapshot(null);
    setShowApporteurSuggestions(false);
    clearApporteur();
  };

  // ============================================
  // EXPORT PDF
  // ============================================

  const exportReservationsPDF = (dateStr: string, resaList: Reservation[]) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text('DEFLOWER CLUB', 20, 22);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text('LISTE DES RESERVATIONS', 20, 30);
    doc.text(`GENERE LE : ${new Date().toLocaleString('fr-FR')}`, 20, 35);

    // Titre
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const displayDate = new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`RESERVATIONS DU ${displayDate.toUpperCase()}`, 20, 55);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(20, 58, 190, 58);

    // Stats (avec normalisation)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const enAttente = resaList.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.EN_ATTENTE).length;
    const venu = resaList.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.VENU).length;
    const confirme = resaList.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.CONFIRME).length;
    const noShow = resaList.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.NO_SHOW).length;
    const recale = resaList.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.RECALE).length;
    const totalGuests = resaList.reduce((acc, r) => acc + (r.numberOfGuests || 1), 0);

    doc.text(`Total : ${resaList.length} reservations | ${totalGuests} couverts prevus`, 20, 66);
    doc.text(`En attente : ${enAttente} | Venus : ${venu} | Confirmes : ${confirme} | No-show : ${noShow} | Recales : ${recale}`, 20, 72);

    // Tableau
    const tableBody = resaList.map(r => {
      const normalized = normalizeReservationStatus(r.status);
      const config = RESERVATION_STATUS_CONFIG[normalized];

      return [
        r.clientName,
        `${r.numberOfGuests || 1}`,
        r.phoneNumber || '-',
        r.businessProvider || '-',
        config.label,
        r.notes || '-'
      ];
    });

    autoTable(doc, {
      startY: 80,
      head: [['CLIENT', 'PERS.', 'TELEPHONE', 'APPORTEUR', 'STATUT', 'NOTES']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [10, 10, 10],
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'middle',
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 'auto' }
      }
    });

    const fileName = `Reservations_Deflower_${dateStr}.pdf`;
    doc.save(fileName);
  };

  // ============================================
  // HELPERS UI
  // ============================================

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // ============================================
  // GÉNÉRATION DU CALENDRIER
  // ============================================

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    for (let i = 1; i < firstDay; i++) {
      days.push({ day: null, dateKey: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(currentYear, currentMonth, day);
      days.push({ day, dateKey });
    }

    return days;
  };

  const calendarDays = useMemo(() => generateCalendarDays(), [currentYear, currentMonth]);
  const todayKeyForCalendar = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Precompute date indicators as a Map to avoid O(n*m) per-cell calls
  const dateIndicators = useMemo(() => {
    const map = new Map<string, { hasConfirme: boolean; hasVenu: boolean; hasEnAttente: boolean; hasNoShow: boolean; count: number }>();
    calendarDays.forEach(day => {
      if (day.dateKey) {
        const dateResas = allResasForDisplay.filter(r => r.date === day.dateKey);
        map.set(day.dateKey, {
          hasConfirme: dateResas.some(r => normalizeReservationStatus(r.status) === ReservationStatus.CONFIRME),
          hasVenu: dateResas.some(r => normalizeReservationStatus(r.status) === ReservationStatus.VENU),
          hasEnAttente: dateResas.some(r => normalizeReservationStatus(r.status) === ReservationStatus.EN_ATTENTE),
          hasNoShow: dateResas.some(r => normalizeReservationStatus(r.status) === ReservationStatus.NO_SHOW),
          count: dateResas.length,
        });
      }
    });
    return map;
  }, [calendarDays, allResasForDisplay]);

  const getDateIndicator = (dateKey: string) => {
    return dateIndicators.get(dateKey) || { hasConfirme: false, hasVenu: false, hasEnAttente: false, hasNoShow: false, count: 0 };
  };

  // Hub suggestion dropdown component (reused for multiple fields)
  const renderHubSuggestions = (fieldName: string) => {
    if (activeField !== fieldName || !showSuggestions || (!hubSearching && hubResults.length === 0)) return null;
    return (
      <div className="absolute z-[200] top-full left-0 right-0 mt-1 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-2xl max-h-48 overflow-y-auto">
        {hubSearching && <p className="px-4 py-2 text-xs text-zinc-500">Recherche Hub...</p>}
        {hubResults.map(c => (
          <button key={c.id} type="button" onClick={() => handleSelectHubCustomer(c)} className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.firstName || c.lastName ? [c.firstName, c.lastName].filter(Boolean).join(' ') : c.displayName}{c.nickname && <span className="ml-1.5 text-zinc-500 font-normal text-xs">"{c.nickname}"</span>}</p>
                {(c.phone || c.email) && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{c.phone}{c.phone && c.email && ' · '}{c.email}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0 text-xs">{c.tags.map(t => <span key={t}>{TAG_EMOJI[t] ?? t}</span>)}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // ============================================
  // RENDU
  // ============================================

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Calendar className="text-zinc-400" size={28} />
            Réservations
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Cliquez sur une date pour voir ou ajouter des réservations
          </p>
        </div>

        {/* Bouton récap si soirée en cours */}
        {currentEvent && todayReservationsRecap.length > 0 && (
          <button
            onClick={() => setShowRecapModal(true)}
            className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-lg transition-colors border border-blue-500/30"
          >
            <Eye size={18} />
            Récap du jour ({todayReservationsRecap.length})
          </button>
        )}
      </div>

      {/* INFO SI SOIRÉE ACTIVE */}
      {currentEvent && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-blue-400 font-medium">Soirée en cours</p>
            <p className="text-zinc-500 text-sm">
              Les réservations du jour ont été importées en liste clients.
              Le statut passe automatiquement à "Venu" lors de la première commande.
              Vous pouvez marquer manuellement "Confirmé" (arrivé), "No-show" ou "Recalé".
            </p>
          </div>
        </div>
      )}

      {/* STATS DU MOIS */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">Ce mois</p>
          <p className="text-2xl font-semibold text-white">{monthStats.total}</p>
          <p className="text-zinc-400 text-xs">réservations</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">Couverts</p>
          <p className="text-2xl font-semibold text-white">{monthStats.totalGuests}</p>
          <p className="text-zinc-400 text-xs">personnes</p>
        </div>
        <div className="bg-zinc-900 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">En attente</p>
          <p className="text-2xl font-semibold text-yellow-400">{monthStats.enAttente}</p>
        </div>
        <div className="bg-zinc-900 border border-green-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">Venus</p>
          <p className="text-2xl font-semibold text-green-400">{monthStats.venu}</p>
        </div>
        <div className="bg-zinc-900 border border-blue-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">Confirmés</p>
          <p className="text-2xl font-semibold text-blue-400">{monthStats.confirme}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">No-show</p>
          <p className="text-2xl font-semibold text-zinc-500">{monthStats.noShow}</p>
        </div>
        <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-4">
          <p className="text-zinc-500 text-sm">Recalés</p>
          <p className="text-2xl font-semibold text-red-400">{monthStats.recale}</p>
        </div>
      </div>

      {/* CALENDRIER */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Navigation du mois */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-zinc-400" />
          </button>

          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">
              {MONTHS[currentMonth]} {currentYear}
            </h3>
            <button
              onClick={goToToday}
              className="text-zinc-400 text-sm hover:underline"
            >
              Aujourd'hui
            </button>
          </div>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ChevronRight size={24} className="text-zinc-400" />
          </button>
        </div>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="p-3 text-center text-zinc-500 text-sm font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Grille du calendrier */}
        <div className="grid grid-cols-7">
          {calendarDays.map((item, index) => {
            if (!item.day || !item.dateKey) {
              return <div key={index} className="p-2 min-h-[80px] bg-zinc-950" />;
            }

            const isToday = item.dateKey === todayKeyForCalendar;
            const isSelected = item.dateKey === selectedDate;
            const isPast = new Date(item.dateKey) < new Date(todayKeyForCalendar);
            const dateIndicator = getDateIndicator(item.dateKey);

            return (
              <button
                key={index}
                onClick={() => handleDateClick(item.dateKey!)}
                className={`
                  p-2 min-h-[80px] border-r border-b border-zinc-800/50
                  transition-all text-left relative cursor-pointer
                  ${isSelected
                    ? 'bg-white/20 ring-2 ring-white/50'
                    : 'hover:bg-zinc-800'
                  }
                  ${isToday ? 'bg-white/10' : ''}
                  ${isPast && !isToday ? 'opacity-70' : ''}
                `}
              >
                <span className={`
                  inline-flex items-center justify-center w-7 h-7 rounded-full text-sm
                  ${isToday
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400'
                  }
                `}>
                  {item.day}
                </span>

                {dateIndicator.count > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={`
                      inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                      ${dateIndicator.hasConfirme ? 'bg-blue-500/20 text-blue-400' :
                        dateIndicator.hasVenu ? 'bg-green-500/20 text-green-400' :
                        dateIndicator.hasEnAttente ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-zinc-700/30 text-zinc-500'}
                    `}>
                      <Users size={10} />
                      {dateIndicator.count}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PANNEAU DATE SÉLECTIONNÉE */}
      {selectedDate && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-lg font-semibold text-white">
              {formatDisplayDate(selectedDate)}
            </h3>
            <div className="flex items-center gap-2">
              {/* Export PDF */}
              {selectedDateReservations.length > 0 && (
                <button
                  onClick={() => exportReservationsPDF(selectedDate, selectedDateReservations)}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <Download size={18} />
                  PDF
                </button>
              )}
              {/* Nouvelle réservation - toujours accessible */}
              {!readOnly && (
                <button
                  onClick={openNewModal}
                  className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  Nouvelle réservation
                </button>
              )}
            </div>
          </div>

          {selectedDateReservations.length === 0 ? (
            <div className="text-center py-8 text-zinc-600">
              <Calendar size={48} className="mx-auto mb-3 opacity-30" />
              <p>Aucune réservation pour cette date</p>
              {!readOnly && (
                <button
                  onClick={openNewModal}
                  className="mt-3 text-zinc-400 hover:underline"
                >
                  Ajouter une réservation
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateReservations.map(reservation => {
                const normalizedStatus = normalizeReservationStatus(reservation.status);
                const associatedClient = (normalizedStatus === ReservationStatus.CONFIRME || normalizedStatus === ReservationStatus.VENU)
                  ? getClientForReservation(reservation.id)
                  : null;
                const isProtected = !canForceDelete && (normalizedStatus === ReservationStatus.VENU || normalizedStatus === ReservationStatus.CONFIRME);
                const config = RESERVATION_STATUS_CONFIG[normalizedStatus];

                // Handler pour le changement de statut
                const handleStatusChange = async (newStatus: ReservationStatus) => {
                  switch (newStatus) {
                    case ReservationStatus.VENU:
                      markReservationArrived(reservation.id);
                      break;
                    case ReservationStatus.CONFIRME:
                      await updateReservation(reservation.id, { status: ReservationStatus.CONFIRME, confirmedAt: new Date().toISOString() });
                      break;
                    case ReservationStatus.RECALE:
                      if (confirm(`Marquer ${reservation.clientName} comme recalé ?`)) {
                        markReservationRefused(reservation.id);
                      }
                      break;
                    case ReservationStatus.NO_SHOW:
                      if (confirm(`Marquer ${reservation.clientName} comme non venu ?`)) {
                        markReservationNoShow(reservation.id);
                      }
                      break;
                    default:
                      break;
                  }
                };

                // Déterminer si on peut modifier (pas encore final)
                const canEdit = normalizedStatus === ReservationStatus.EN_ATTENTE ||
                                normalizedStatus === ReservationStatus.VENU;

                return (
                  <div
                    key={reservation.id}
                    className={`bg-zinc-800 border rounded-xl p-4 ${config.borderColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* En-tête */}
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h4 className="text-white font-semibold text-lg">
                            {reservation.clientName}
                          </h4>
                          {/* Hub badge */}
                          {reservation.customerSnapshot && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 font-semibold">HUB</span>
                          )}
                          {/* Dropdown de statut ou badge si readOnly */}
                          {readOnly ? (
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                              {config.label}
                            </span>
                          ) : (
                            <ReservationStatusDropdown
                              currentStatus={reservation.status}
                              onStatusChange={handleStatusChange}
                              disabled={normalizedStatus === ReservationStatus.CONFIRME ||
                                        normalizedStatus === ReservationStatus.NO_SHOW ||
                                        normalizedStatus === ReservationStatus.RECALE}
                            />
                          )}
                        </div>

                        {/* Infos */}
                        <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Users size={14} className="text-zinc-400" />
                            {reservation.numberOfGuests} pers.
                          </span>
                          {reservation.phoneNumber && (
                            <span className="flex items-center gap-1">
                              <Phone size={14} className="text-zinc-400" />
                              {reservation.phoneNumber}
                            </span>
                          )}
                          {reservation.businessProvider && (
                            <span className="flex items-center gap-1 text-purple-400">
                              App: {reservation.businessProvider}
                            </span>
                          )}
                        </div>

                        {/* Info client venu/confirmé avec total — two-level display */}
                        {(normalizedStatus === ReservationStatus.CONFIRME || normalizedStatus === ReservationStatus.VENU) && associatedClient && (
                          <div className={`mt-2 p-2 rounded-lg ${normalizedStatus === ReservationStatus.VENU ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                            <p className={`text-sm flex items-center gap-2 ${normalizedStatus === ReservationStatus.VENU ? 'text-green-400' : 'text-blue-400'}`}>
                              <CheckCircle2 size={14} />
                              Client {normalizedStatus === ReservationStatus.VENU ? 'venu' : 'confirmé'} - Total: <span className="font-semibold">{getClientTotal(associatedClient.id, associatedClient.totalSpent, associatedClient.status).toFixed(0)}€</span>
                            </p>
                          </div>
                        )}
                        {/* Total stocké sur la résa (après clôture) — fallback when no live client */}
                        {(normalizedStatus === ReservationStatus.VENU || normalizedStatus === ReservationStatus.CONFIRME) && !associatedClient && (reservation.totalSpent ?? 0) > 0 && (
                          <div className={`mt-2 p-2 rounded-lg ${normalizedStatus === ReservationStatus.VENU ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                            <p className={`text-sm flex items-center gap-2 ${normalizedStatus === ReservationStatus.VENU ? 'text-green-400' : 'text-blue-400'}`}>
                              <CheckCircle2 size={14} />
                              Client {normalizedStatus === ReservationStatus.VENU ? 'venu' : 'confirmé'} - Total: <span className="font-semibold">{(reservation.totalSpent ?? 0).toFixed(0)}€</span>
                            </p>
                          </div>
                        )}

                        {/* Notes */}
                        {reservation.notes && (
                          <p className="mt-2 text-sm text-zinc-600 italic flex items-center gap-1">
                            <FileText size={12} />
                            {reservation.notes}
                          </p>
                        )}

                        {/* Créateur */}
                        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 text-xs text-zinc-600">
                          <UserCircle size={14} />
                          Créée par <span className="text-zinc-400">{reservation.createdByName || 'Inconnu'}</span>
                          {reservation.createdAt && (
                            <>
                              <span className="mx-1">•</span>
                              <Clock size={12} />
                              {new Date(reservation.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions simplifiées */}
                      {!readOnly && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 sm:mt-0 sm:ml-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                          {/* Modifier - si pas encore final */}
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(reservation)}
                              className="p-1.5 sm:p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit3 size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                          )}
                          {/* Supprimer — interdit si client venu ou confirmé */}
                          {!isProtected && (
                            <button
                              onClick={() => {
                                if (confirm(`Supprimer définitivement la réservation de ${reservation.clientName} ?\nCette action est irréversible.`)) {
                                  deleteReservation(reservation.id);
                                }
                              }}
                              className="p-1.5 sm:p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                              title="Supprimer définitivement"
                            >
                              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CRÉATION/ÉDITION */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md my-auto flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Calendar className="text-zinc-400" size={24} />
                {editingReservation ? 'Modifier' : 'Nouvelle'} Réservation
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Date affichée */}
            {selectedDate && (
              <div className="mb-4 p-3 bg-white/10 rounded-lg text-center">
                <p className="text-zinc-400 font-medium">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>
            )}

            {/* Hub linked badge */}
            {hubCustomerId && hubSnapshot && (
              <div className="mb-4 flex items-center gap-2 text-xs p-2 bg-emerald-400/5 border border-emerald-400/20 rounded-lg">
                <span className="text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full font-bold">HUB</span>
                <span className="text-white/60">{hubSnapshot.displayName}</span>
                {hubSnapshot.nickname && <span className="text-white/40">"{hubSnapshot.nickname}"</span>}
                <button onClick={() => { setHubCustomerId(null); setHubSnapshot(null); }} className="text-white/30 hover:text-white/60 ml-auto">
                  <X size={12} />
                </button>
              </div>
            )}

            <div ref={formWrapperRef} className="space-y-4">
              {/* Prénom + Nom with inline Hub search */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-sm text-zinc-500 mb-1">
                    Prénom <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clientFirstName}
                    onChange={(e) => handleFieldChange('clientFirstName', e.target.value)}
                    onFocus={() => { setActiveField('clientFirstName'); if (formData.clientFirstName.trim().length >= 2) triggerHubSearch(formData.clientFirstName); }}
                    placeholder="JEAN"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white uppercase placeholder-zinc-600 focus:border-white focus:outline-none"
                    autoFocus
                    autoComplete="off"
                  />
                  {renderHubSuggestions('clientFirstName')}
                </div>
                <div className="relative">
                  <label className="block text-sm text-zinc-500 mb-1">
                    Nom <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clientLastName}
                    onChange={(e) => handleFieldChange('clientLastName', e.target.value)}
                    onFocus={() => { setActiveField('clientLastName'); if (formData.clientLastName.trim().length >= 2) triggerHubSearch(formData.clientLastName); }}
                    placeholder="DUPONT"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white uppercase placeholder-zinc-600 focus:border-white focus:outline-none"
                    autoComplete="off"
                  />
                  {renderHubSuggestions('clientLastName')}
                </div>
              </div>

              {/* Surnom */}
              <div className="relative">
                <label className="block text-sm text-zinc-500 mb-1">
                  Surnom <span className="text-zinc-600">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={formData.nickname}
                  onChange={(e) => handleFieldChange('nickname', e.target.value)}
                  onFocus={() => { setActiveField('nickname'); if (formData.nickname.trim().length >= 2) triggerHubSearch(formData.nickname); }}
                  placeholder="SURNOM"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white uppercase placeholder-zinc-600 focus:border-white focus:outline-none"
                  autoComplete="off"
                />
                {renderHubSuggestions('nickname')}
              </div>

              {/* Nombre de personnes */}
              <div>
                <label className="block text-sm text-zinc-500 mb-1">
                  Nombre de personnes <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.numberOfGuests}
                  onChange={(e) => setFormData({...formData, numberOfGuests: e.target.value ? parseInt(e.target.value) || '' : ''})}
                  placeholder="Nombre de personnes"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                />
              </div>

              {/* Téléphone */}
              <div className="relative">
                <label className="block text-sm text-zinc-500 mb-1">
                  Téléphone <span className="text-zinc-600">(optionnel)</span>
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleFieldChange('phoneNumber', e.target.value, false)}
                  onFocus={() => { setActiveField('phoneNumber'); if (formData.phoneNumber.trim().length >= 2) triggerHubSearch(formData.phoneNumber); }}
                  placeholder="06 12 34 56 78"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none"
                  autoComplete="off"
                />
                {renderHubSuggestions('phoneNumber')}
              </div>

              {/* Apporteur d'affaires */}
              <div className="relative">
                <label className="block text-sm text-zinc-500 mb-1">
                  Apporteur d'affaires <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.businessProvider}
                  onChange={(e) => handleApporteurChange(e.target.value)}
                  onFocus={() => { if (formData.businessProvider.trim().length >= 2) { setShowApporteurSuggestions(true); searchApporteur(formData.businessProvider); } }}
                  placeholder="NOM DE L'APPORTEUR"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white uppercase placeholder-zinc-600 focus:border-white focus:outline-none"
                  autoComplete="off"
                />
                {showApporteurSuggestions && (searchingApporteur || apporteurResults.length > 0 || formData.businessProvider.trim().length >= 2) && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 shadow-2xl max-h-48 overflow-y-auto">
                    {searchingApporteur && <p className="px-4 py-2 text-xs text-zinc-500">Recherche Hub...</p>}
                    {apporteurResults.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectApporteur(a)}
                        className="w-full text-left px-4 py-2.5 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{a.name}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">{a.id}</span>
                        </div>
                      </button>
                    ))}
                    {formData.businessProvider.trim().length >= 2 && !apporteurResults.some(a => a.name.toLowerCase() === formData.businessProvider.trim().toLowerCase()) && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleCreateApporteur(formData.businessProvider.trim())}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-500/10 transition-colors text-emerald-400 text-xs font-medium"
                      >
                        + Créer "{formData.businessProvider.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-zinc-500 mb-1">
                  Note <span className="text-zinc-600">(optionnel)</span>
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Informations supplémentaires..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:border-white focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.clientLastName.trim() || !formData.clientFirstName.trim() || !formData.numberOfGuests || !formData.businessProvider.trim()}
                className="flex-1 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black py-3 rounded-lg font-semibold transition-colors"
              >
                {editingReservation ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RÉCAP DU JOUR */}
      {showRecapModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-blue-500/30 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Eye className="text-blue-400" size={24} />
                Récap des Réservations du Jour
              </h3>
              <button
                onClick={() => setShowRecapModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-6 gap-2 sm:gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-white">{todayReservationsRecap.length}</p>
                <p className="text-[10px] sm:text-xs text-zinc-500">Total</p>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-yellow-400">
                  {todayReservationsRecap.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.EN_ATTENTE).length}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-500">En attente</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-green-400">
                  {todayReservationsRecap.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.VENU).length}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-500">Venus</p>
              </div>
              <div className="bg-blue-500/10 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-blue-400">
                  {todayReservationsRecap.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.CONFIRME).length}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-500">Confirmés</p>
              </div>
              <div className="bg-zinc-800 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-zinc-500">
                  {todayReservationsRecap.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.NO_SHOW).length}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-500">No-show</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-2 sm:p-3 text-center">
                <p className="text-xl sm:text-2xl font-semibold text-red-400">
                  {todayReservationsRecap.filter(r => normalizeReservationStatus(r.status) === ReservationStatus.RECALE).length}
                </p>
                <p className="text-[10px] sm:text-xs text-zinc-500">Recalés</p>
              </div>
            </div>

            {/* Export PDF */}
            <button
              onClick={() => exportReservationsPDF(todayKey, todayReservationsRecap)}
              className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold px-4 py-3 rounded-lg transition-colors mb-6"
            >
              <Download size={18} />
              Exporter en PDF
            </button>

            {/* Liste détaillée */}
            <div className="space-y-3">
              {todayReservationsRecap.map(reservation => {
                const normalizedStatus = normalizeReservationStatus(reservation.status);
                const config = RESERVATION_STATUS_CONFIG[normalizedStatus];
                const associatedClient = (normalizedStatus === ReservationStatus.CONFIRME || normalizedStatus === ReservationStatus.VENU)
                  ? getClientForReservation(reservation.id)
                  : null;
                const resaTotalSpent = reservation.totalSpent;

                return (
                  <div
                    key={reservation.id}
                    className={`bg-zinc-800 border rounded-xl p-4 ${config.borderColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h4 className="text-white font-semibold">{reservation.clientName}</h4>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {reservation.numberOfGuests} pers.
                          </span>
                          {reservation.businessProvider && (
                            <span className="text-purple-400">App: {reservation.businessProvider}</span>
                          )}
                        </div>
                      </div>

                      {/* Montant si confirmé ou venu */}
                      {(normalizedStatus === ReservationStatus.CONFIRME || normalizedStatus === ReservationStatus.VENU) && (associatedClient || (resaTotalSpent ?? 0) > 0) && (
                        <div className="text-right">
                          <p className={`font-semibold text-lg ${normalizedStatus === ReservationStatus.VENU ? 'text-green-400' : 'text-blue-400'}`}>
                            {associatedClient
                              ? getClientTotal(associatedClient.id, associatedClient.totalSpent, associatedClient.status).toFixed(0)
                              : resaTotalSpent?.toFixed(0) || '0'}€
                          </p>
                          <p className="text-xs text-zinc-600">Total dépensé</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationsManager;
