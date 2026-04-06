import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { useStore } from '../store/index';
import {
  TableStatus, Table, Client, UserRole, OrderStatus, EveningEvent,
  ReservationStatus, RESERVATION_STATUS_CONFIG, normalizeReservationStatus
} from '../src/types';
import {
  Users, Plus, X, List, Map as MapIcon, ArrowRightLeft, TrendingUp, Clock, History,
  ShieldCheck, User, Trash2, Edit3, FileSpreadsheet, Download, Trophy, Briefcase, Calendar,
  Info, AlertCircle, UserMinus, Link, Play, StopCircle, AlertTriangle, Pencil, Check,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from 'recharts';
import TableMap from './TableMap';
import ReservationsManager from './ReservationsManager';
import { FreeTableModal } from './modals';
import { formatCurrency, aggregateEventData, CHART_COLORS } from '../src/utils';
import { useExport } from '../src/hooks/useExport';
import { useToast, ReservationStatusDropdown } from './ui';

const HubClientsPage = lazy(() => import('./HubClientsPage'));

const HostessDashboard: React.FC = () => {
  const {
    tables, clients, orders, users, createClient, transferClient, assignClient,
    currentUser, removeClient, updateClientName, updateClientBusinessProvider, unassignClient,
    pastEvents, updateArchivedApporteur, updateTableStatus, currentEvent,
    allReservations, markReservationArrived, markReservationRefused, markReservationNoShow,
    addNotification, linkTableToClient, unlinkTableFromClient,
    startEvening, closeEvening
  } = useStore();

  const toast = useToast();

  // --- ÉTATS NAVIGATION ---
  // Si pas de soirée active, on démarre sur les réservations
  const [activeTab, setActiveTab] = useState<'live' | 'archives' | 'reservations' | 'history' | 'clients'>(currentEvent ? 'live' : 'reservations');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  // Mode hors soirée - L'hôtesse n'a accès qu'aux Archives et Réservations
  const isOfflineMode = !currentEvent;

  // 🔄 Rediriger vers live quand une soirée démarre
  useEffect(() => {
    if (currentEvent && (activeTab === 'reservations' || activeTab === 'archives')) {
      setActiveTab('live');
    }
  }, [currentEvent]);

  // 🔄 Rediriger vers réservations si la soirée se termine pendant l'utilisation
  useEffect(() => {
    if (isOfflineMode && (activeTab === 'live' || activeTab === 'history')) {
      setActiveTab('reservations');
    }
  }, [isOfflineMode, activeTab]);

  // --- ÉTATS MODALS LIVE ---
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // --- ÉTAT TABLE LIBRE ---
  const [freeTableForAction, setFreeTableForAction] = useState<Table | null>(null);

  // --- ÉTAT LIAISON TABLE ---
  const [showLinkTableModal, setShowLinkTableModal] = useState(false);
  const [clientToLink, setClientToLink] = useState<Client | null>(null);
  const [linkTargetTableId, setLinkTargetTableId] = useState('');

  // --- ÉTATS GESTION SOIRÉE ---
  const [showStartModal, setShowStartModal] = useState(false);
  const [startData, setStartData] = useState({ date: new Date().toISOString().split('T')[0], name: '' });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeConfirmStep, setCloseConfirmStep] = useState(1);

  // --- ÉTATS ARCHIVES ---
  const [selectedArchive, setSelectedArchive] = useState<EveningEvent | null>(null);
  const [editingApporteur, setEditingApporteur] = useState<{name: string, value: string} | null>(null);

  // --- ÉTATS HISTORIQUE (soirée en cours - clients encaissés) ---
  const [editingHistoryField, setEditingHistoryField] = useState<{ clientId: string; field: 'name' | 'apporteur'; currentValue: string } | null>(null);
  const [editHistoryFieldValue, setEditHistoryFieldValue] = useState('');

  // --- ÉTATS FORMULAIRES ---
  const [selectedWaiterId, setSelectedWaiterId] = useState('');
  const [clientToProcess, setClientToProcess] = useState<Client | null>(null);
  const [targetTableId, setTargetTableId] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // --- DONNÉES CALCULÉES ---
  const availableTables = tables.filter(t => t.status === TableStatus.AVAILABLE);
  const waiters = users.filter(u => u.role === UserRole.WAITER && u.isActive);
  const sortedPastEvents = useMemo(() => [...pastEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [pastEvents]);

  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const filteredPastEvents = useMemo(() => {
    if (!filterMonth) return sortedPastEvents;
    return sortedPastEvents.filter(e => e.date.startsWith(filterMonth));
  }, [sortedPastEvents, filterMonth]);

  const navigateMonth = useCallback((dir: number) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }, [filterMonth]);

  const filterMonthLabel = useMemo(() => {
    const [y, m] = filterMonth.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [filterMonth]);

  const COLORS = CHART_COLORS;
  const { exportToPDF, exportToExcel } = useExport();

  const archiveWaiterStats = useMemo(() => {
    if (!selectedArchive || !selectedArchive.detailedHistory) return [];
    const stats: { [key: string]: number } = {};
    selectedArchive.detailedHistory.forEach((entry: any) => {
      const wName = entry.waiterName || 'Non Spécifié'; 
      stats[wName] = (stats[wName] || 0) + entry.totalAmount;
    });
    return Object.entries(stats).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [selectedArchive]);

  // Tous les clients encaissés de la soirée en cours (club + lounge)
  const allClosedClients = useMemo(() =>
    clients.filter(c => c.status === 'closed'),
    [clients]
  );

  const handleSaveHistoryField = useCallback(async () => {
    if (!editingHistoryField || !editHistoryFieldValue.trim()) return;
    if (editingHistoryField.field === 'name') {
      await updateClientName(editingHistoryField.clientId, editHistoryFieldValue.trim());
    } else {
      await updateClientBusinessProvider(editingHistoryField.clientId, editHistoryFieldValue.trim());
    }
    setEditingHistoryField(null);
    setEditHistoryFieldValue('');
  }, [editingHistoryField, editHistoryFieldValue, updateClientName, updateClientBusinessProvider]);

  // =====================================================
  // ✅ HANDLERS GESTION SOIRÉE
  // =====================================================

  const handleStartEvening = useCallback(() => {
    if (!startData.date) return;
    startEvening(startData.date, startData.name || 'Soirée Deflower');
    setShowStartModal(false);
    setStartData({ date: new Date().toISOString().split('T')[0], name: '' });
  }, [startData, startEvening]);

  const handleCloseEveningStep1 = useCallback(() => {
    setCloseConfirmStep(2);
  }, []);

  const handleCloseEveningConfirm = useCallback(() => {
    closeEvening();
    setShowCloseConfirm(false);
    setCloseConfirmStep(1);
  }, [closeEvening]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
    setCloseConfirmStep(1);
  }, []);

  // =====================================================
  // ✅ HANDLERS OPTIMISÉS AVEC useCallback
  // =====================================================

  const generateExcelReport = useCallback((event: EveningEvent) => {
    exportToExcel(event);
  }, [exportToExcel]);

  const generatePDFReport = useCallback((event: EveningEvent) => {
    exportToPDF(event);
  }, [exportToPDF]);

  // ==========================================
  // 🔧 FIX: handleAssignSubmit - SERVEUR OPTIONNEL
  // ==========================================
  // L'hôtesse peut maintenant assigner SEULEMENT une table
  // Les serveurs récupèreront le client depuis leur liste "À récupérer"
  // ==========================================
  const handleAssignSubmit = useCallback(async () => {
    if (!clientToProcess || !targetTableId) return;

    const tableName = tables.find(t => t.id === targetTableId)?.number;

    if (selectedWaiterId) {
      await assignClient(clientToProcess.id, targetTableId, selectedWaiterId);
      const waiterName = users.find(u => u.id === selectedWaiterId)?.firstName;
      toast.success('Client placé', `${clientToProcess.name} → Table ${tableName} (${waiterName})`);
    } else {
      await assignClient(clientToProcess.id, targetTableId, '');
      toast.info('Table assignée', `${clientToProcess.name} → Table ${tableName} (sans serveur)`);
    }

    setClientToProcess(null);
    setTargetTableId('');
    setSelectedWaiterId('');
    setShowAssignModal(false);
  }, [clientToProcess, targetTableId, selectedWaiterId, assignClient, tables, users, toast]);

  const handleTransferSubmit = useCallback(async () => {
    if (clientToProcess && targetTableId) {
      try {
        const tableName = tables.find(t => t.id === targetTableId)?.number;
        await transferClient(clientToProcess.id, targetTableId);
        toast.success('Transfert effectué', `${clientToProcess.name} → Table ${tableName}`);
        setClientToProcess(null);
        setTargetTableId('');
        setShowTransferModal(false);
      } catch {
        addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
      }
    }
  }, [clientToProcess, targetTableId, transferClient, tables, toast, addNotification]);

  const handleDeleteClient = useCallback((client: Client) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le client ${client.name} ?`)) {
      removeClient(client.id);
      toast.warning('Client supprimé', client.name);
    }
  }, [removeClient, toast]);

  // Handler pour désassigner un client de sa table (sans le supprimer)
  const handleUnassignClient = useCallback(async (client: Client) => {
    if (confirm(`Retirer ${client.name} de sa table ? Le client restera dans la liste en attente.`)) {
      await unassignClient(client.id);
      toast.info('Client désassigné', `${client.name} est maintenant en attente`);
    }
  }, [unassignClient, toast]);

  const openEditClient = useCallback((client: Client) => {
    setEditingClient(client);
    setEditNameValue(client.name);
  }, []);

  const handleUpdateName = useCallback(async () => {
    if (editingClient && editNameValue.trim()) {
        await updateClientName(editingClient.id, editNameValue.trim());
        setEditingClient(null);
        setEditNameValue('');
    }
  }, [editingClient, editNameValue, updateClientName]);

  const openAssignModal = useCallback((client: Client) => {
    setClientToProcess(client);
    setTargetTableId('');
    setSelectedWaiterId('');
    setShowAssignModal(true);
  }, []);

  const openTransferModal = useCallback((client: Client) => {
    setClientToProcess(client);
    setTargetTableId('');
    setShowTransferModal(true);
  }, []);

  const handleSaveApporteur = useCallback(async () => {
    if (editingApporteur && selectedArchive) {
      await updateArchivedApporteur(selectedArchive.id, editingApporteur.name, editingApporteur.value);
      setEditingApporteur(null);
    }
  }, [editingApporteur, selectedArchive, updateArchivedApporteur]);

  // --- HANDLER TABLE CLICK (plan de salle) ---
  // 🔧 FIX: Priorité aux clients actifs pour éviter qu'un ancien client encaissé masque le nouveau
  const handleTableClick = useCallback((table: Table) => {
    const client = clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      (c.status === 'assigned' || c.status === 'pending')
    ) || clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      c.status === 'closed'
    );
    if (client) {
      setClientToProcess(client);
    } else if (table.status === TableStatus.AVAILABLE) {
      setFreeTableForAction(table);
    }
  }, [clients]);

  // --- HANDLERS FREE TABLE MODAL ---
  const handleFreeTableCreateClient = useCallback((name: string, apporteur?: string, waiterId?: string) => {
    if (!freeTableForAction) return;
    createClient(name, apporteur || '', freeTableForAction.id, waiterId || '');
    const tableLabel = freeTableForAction.number.toUpperCase().startsWith('BAR')
      ? freeTableForAction.number
      : `Table ${freeTableForAction.number}`;
    toast.success('Client installé', `${name} → ${tableLabel}`);
  }, [freeTableForAction, createClient, toast]);

  const handleFreeTableAssignExisting = useCallback((clientId: string, waiterId?: string) => {
    if (!freeTableForAction) return;
    assignClient(clientId, freeTableForAction.id, waiterId || '');
    const client = clients.find(c => c.id === clientId);
    const tableLabel = freeTableForAction.number.toUpperCase().startsWith('BAR')
      ? freeTableForAction.number
      : `Table ${freeTableForAction.number}`;
    toast.success('Client installé', `${client?.name || ''} → ${tableLabel}`);
  }, [freeTableForAction, assignClient, clients, toast]);

  // Clients en attente (pas de table)
  const pendingClientsForTable = useMemo(() =>
    clients.filter(c => c.status === 'pending' && !c.tableId),
    [clients]
  );

  // --- HANDLERS LIAISON TABLE ---
  const openLinkTableModal = useCallback((client: Client) => {
    setClientToLink(client);
    setLinkTargetTableId('');
    setShowLinkTableModal(true);
  }, []);

  const handleLinkTableSubmit = useCallback(() => {
    if (clientToLink && linkTargetTableId) {
      const linkedTable = tables.find(t => t.id === linkTargetTableId);
      linkTableToClient(clientToLink.id, linkTargetTableId);
      setLinkTargetTableId('');
      setShowLinkTableModal(false);
      setClientToLink(null);
      toast.success('Table liée', `Table ${linkedTable?.number} → ${clientToLink.name}`);
    }
  }, [clientToLink, linkTargetTableId, linkTableToClient, tables, toast]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* HEADER AVEC ONGLETS - Premium Design */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 fade-in-up min-w-0 w-full">
        <div>
            <h2 className="text-3xl font-semibold text-white tracking-tighter uppercase">Espace Hôtesse</h2>
            <div className="flex items-center gap-3 mt-1">
                <div className="gold-line w-8"></div>
                <span className="text-zinc-400 text-xs font-medium">
                    {isOfflineMode ? 'Mode Archives & Réservations' : 'Accueil & Placement'}
                </span>
                <span className="bg-zinc-800 text-zinc-400 text-xs font-medium px-2 py-1 rounded-full border border-zinc-700 uppercase">
                    {currentUser?.firstName}
                </span>
                {isOfflineMode && (
                    <span className="bg-amber-500/10 text-amber-500 text-xs font-medium px-2 py-1 rounded-full border border-amber-500/20 uppercase badge-pulse">
                        Hors Soirée
                    </span>
                )}
            </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-1.5 rounded-xl flex gap-1 w-full max-w-full overflow-x-auto no-scrollbar flex-nowrap">
            {/* Onglet Live - Masqué en mode hors soirée */}
            {!isOfflineMode && (
                <button
                    onClick={() => setActiveTab('live')}
                    className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-medium uppercase transition-all ${activeTab ==='live' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Users className="w-4 h-4" /> Live
                </button>
            )}
            {/* Onglet Historique - Clients encaissés de la soirée en cours */}
            {!isOfflineMode && (
                <button
                    onClick={() => setActiveTab('history')}
                    className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-medium uppercase transition-all ${activeTab ==='history' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <History className="w-4 h-4" /> Historique {allClosedClients.length > 0 && `(${allClosedClients.length})`}
                </button>
            )}
            <button
                onClick={() => setActiveTab('reservations')}
                className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-medium uppercase transition-all ${activeTab ==='reservations' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Calendar className="w-4 h-4" /> Résa
            </button>
            <button
                onClick={() => setActiveTab('archives')}
                className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-medium uppercase transition-all ${activeTab ==='archives' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <History className="w-4 h-4" /> Récap
            </button>
            <button
                onClick={() => setActiveTab('clients')}
                className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-medium uppercase transition-all ${activeTab ==='clients' ? 'text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Users className="w-4 h-4" /> Clients
            </button>
        </div>
      </div>

      {/* --- BANDEAU MODE HORS SOIRÉE + DÉMARRER --- */}
      {isOfflineMode && (
        <div className="space-y-4 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-amber-500/20 p-3 rounded-full shrink-0">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white uppercase tracking-tight">
                Aucune soirée active
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                Vous pouvez consulter les archives, modifier les apporteurs d'affaires et régénérer les rapports.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowStartModal(true)}
            className="w-full flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-medium text-sm transition-all active:scale-95"
          >
            <Play className="w-5 h-5" /> Démarrer la soirée
          </button>
        </div>
      )}

      {/* --- BOUTON CLÔTURER (quand soirée active) --- */}
      {!isOfflineMode && (
        <div className="mb-4">
          <button
            onClick={() => setShowCloseConfirm(true)}
            className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium text-xs transition-all active:scale-95"
          >
            <StopCircle className="w-4 h-4" /> Clôturer la soirée
          </button>
        </div>
      )}

      {/* --- ONGLET LIVE --- */}
      {activeTab === 'live' && (
        <div className="fade-in-up space-y-6 max-w-2xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
                <button
                onClick={() => setActiveTab('reservations')}
                className="col-span-2 bg-white text-black py-8 rounded-xl font-medium text-2xl flex items-center justify-center gap-4"
                >
                <Calendar className="w-8 h-8" /> NOUVELLE RÉSERVATION
                </button>

                <button
                onClick={() => setViewMode('list')}
                className={`py-5 rounded-xl font-medium text-xs flex items-center justify-center gap-3 border-2 transition-all ${viewMode === 'list' ? 'bg-white text-black border-white' : 'bg-zinc-900 border border-zinc-800 text-white border-zinc-800 hover:border-zinc-700'}`}
                >
                <List className="w-5 h-5" /> LISTE
                </button>
                <button
                onClick={() => setViewMode('map')}
                className={`py-5 rounded-xl font-medium text-xs flex items-center justify-center gap-3 border-2 transition-all ${viewMode === 'map' ? 'bg-white text-black border-white' : 'bg-zinc-900 border border-zinc-800 text-white border-zinc-800 hover:border-zinc-700'}`}
                >
                <MapIcon className="w-5 h-5" /> PLAN
                </button>
            </div>

            {viewMode === 'map' ? (
                <div className="mt-2">
                <TableMap tables={tables} clients={clients} onTableClick={handleTableClick} />
                </div>
            ) : (
                <div className="space-y-4">
                {clients.length === 0 && (
                    <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-medium text-sm">
                    Aucun client enregistré ce soir
                    </div>
                )}
                
                {clients.map((client, idx) => {
                    const table = tables.find(t => t.id === client.tableId);
                    const isClosed = client.status === 'closed';
                    const waiter = users.find(u => u.id === client.waiterId);
                    // 🆕 Client avec table mais sans serveur
                    const hasTableNoWaiter = table && !waiter && !isClosed;
                    // 🆕 Trouver la réservation liée au client
                    const linkedReservation = client.reservationId
                      ? allReservations.find(r => r.id === client.reservationId)
                      : null;

                    // Handler pour changement de statut réservation
                    const handleReservationStatusChange = (newStatus: ReservationStatus) => {
                      if (!client.reservationId) return;
                      switch (newStatus) {
                        case ReservationStatus.VENU:
                          markReservationArrived(client.reservationId);
                          toast.info('Statut mis à jour', `${client.name} marqué comme arrivé`);
                          break;
                        case ReservationStatus.RECALE:
                          if (confirm(`Marquer ${client.name} comme recalé ?`)) {
                            markReservationRefused(client.reservationId);
                            toast.warning('Client recalé', client.name);
                          }
                          break;
                        case ReservationStatus.NO_SHOW:
                          if (confirm(`Marquer ${client.name} comme non venu ?`)) {
                            markReservationNoShow(client.reservationId);
                            toast.warning('No-show', client.name);
                          }
                          break;
                        default:
                          break;
                      }
                    };

                    return (
                    <div key={client.id} style={{ animationDelay: `${idx * 50}ms` }} className={`premium-card bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between relative overflow-hidden transition-all gap-4 fade-in-up ${isClosed ? 'opacity-40 border-zinc-800 bg-black/20' : hasTableNoWaiter ? 'border-amber-500/30 bg-amber-900/10' : 'border-zinc-800 hover:border-zinc-700'}`}>

                        <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className={`text-2xl font-semibold truncate uppercase tracking-tighter ${isClosed ? 'text-zinc-500' : 'text-white'}`}>{client.name}</h3>
                            {client.createdByName && (
                            <span className="text-xs font-medium text-zinc-400 uppercase bg-zinc-800 px-2 py-0.5 rounded italic shrink-0">
                                By {client.createdByName.split(' ')[0]}
                            </span>
                            )}
                            {/* 🆕 Dropdown statut réservation si client issu d'une réservation */}
                            {linkedReservation && !isClosed && (
                              <ReservationStatusDropdown
                                currentStatus={linkedReservation.status}
                                onStatusChange={handleReservationStatusChange}
                                disabled={
                                  normalizeReservationStatus(linkedReservation.status) === ReservationStatus.CONFIRME ||
                                  normalizeReservationStatus(linkedReservation.status) === ReservationStatus.NO_SHOW ||
                                  normalizeReservationStatus(linkedReservation.status) === ReservationStatus.RECALE
                                }
                              />
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            {client.businessProvider && (
                            <span className="text-xs font-medium bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full truncate border border-zinc-700 uppercase max-w-[150px]">
                                P: {client.businessProvider}
                            </span>
                            )}
                            {isClosed ? (
                            <span className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-500/20 uppercase">
                                <History className="w-3 h-3" /> ENCAISSÉ
                            </span>
                            ) : table ? (
                            <span className="text-xs font-medium bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full flex items-center gap-2 border border-zinc-700 uppercase">
                                TABLE {table.number}
                            </span>
                            ) : (
                            <span className="text-xs font-medium bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full flex items-center gap-2 border border-amber-500/20 uppercase">
                                <Clock className="w-3 h-3" /> EN ATTENTE
                            </span>
                            )}
                            {waiter ? (
                            <span className="text-xs font-medium bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full flex items-center gap-2 border border-indigo-500/20 uppercase">
                                <User className="w-3 h-3" /> {waiter.firstName}
                            </span>
                            ) : table && !isClosed && (
                            <span className="text-xs font-medium bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full flex items-center gap-2 border border-amber-500/30 uppercase animate-pulse">
                                <User className="w-3 h-3" /> À RÉCUPÉRER
                            </span>
                            )}
                            {/* Tables liées */}
                            {client.linkedTableIds && client.linkedTableIds.length > 0 && client.linkedTableIds.map(ltId => {
                              const lt = tables.find(t => t.id === ltId);
                              return lt ? (
                                <span key={ltId} className="text-xs font-medium bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full flex items-center gap-2 border border-blue-500/20 uppercase">
                                  <Link className="w-3 h-3" /> T{lt.number}
                                  {!isClosed && (
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm(`Dissocier la table ${lt.number} de ${client.name} ?`)) { unlinkTableFromClient(client.id, ltId); toast.info('Table dissociée', `Table ${lt.number}`); }}} className="ml-1 text-red-400 hover:text-red-300">
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              ) : null;
                            })}
                        </div>
                        </div>
                        
                        {!isClosed && (
                        <div className="flex gap-2 shrink-0">
                            <button onClick={() => openEditClient(client)} className="p-4 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 active:scale-95 hover:bg-amber-500/20 transition-all" title="Modifier le nom"><Edit3 className="w-5 h-5" /></button>
                            {!table ? (
                            <button onClick={() => openAssignModal(client)} className="p-4 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 active:scale-95 hover:bg-emerald-500 hover:text-white transition-all" title="Installer à une table"><Plus className="w-5 h-5" /></button>
                            ) : (
                            <>
                            <button onClick={() => openTransferModal(client)} className="p-4 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 active:scale-95 hover:bg-blue-500 hover:text-white transition-all" title="Transférer de table"><ArrowRightLeft className="w-5 h-5" /></button>
                            <button onClick={() => openLinkTableModal(client)} className="p-4 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 active:scale-95 hover:bg-blue-500 hover:text-white transition-all" title="Lier une table"><Link className="w-5 h-5" /></button>
                            <button onClick={() => handleUnassignClient(client)} className="p-4 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 active:scale-95 hover:bg-orange-500 hover:text-white transition-all" title="Retirer de la table"><UserMinus className="w-5 h-5" /></button>
                            </>
                            )}
                            <button onClick={() => handleDeleteClient(client)} className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 active:scale-95 hover:bg-red-500 hover:text-white transition-all" title="Supprimer"><Trash2 className="w-5 h-5" /></button>
                        </div>
                        )}
                    </div>
                    );
                })}
                </div>
            )}
        </div>
      )}

      {/* --- ONGLET HISTORIQUE (soirée en cours - clients encaissés) --- */}
      {activeTab === 'history' && (
        <div className="fade-in-up space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-emerald-400 uppercase">Clients Encaissés</h3>
            <div className="flex-1 h-px bg-emerald-500/20"></div>
            <span className="text-emerald-400 text-xs font-medium">{allClosedClients.length} client{allClosedClients.length > 1 ? 's' : ''}</span>
          </div>

          {allClosedClients.length === 0 ? (
            <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-medium text-sm">
              Aucun client encaissé
            </div>
          ) : (
            <div className="space-y-3">
              {allClosedClients.map(client => {
                const table = tables.find(t => t.id === client.tableId);
                const waiter = users.find(u => u.id === client.waiterId);
                const zone = table?.zone || (table?.number?.toUpperCase().startsWith('BAR') ? 'bar' : 'club');
                return (
                  <div key={client.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border border-emerald-500/10">
                    {/* Ligne 1: Table + Nom + Total */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-zinc-400 font-semibold text-lg shrink-0">{table?.number?.toUpperCase().startsWith('BAR') ? table.number : `T${table?.number || '?'}`}</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {editingHistoryField?.clientId === client.id && editingHistoryField.field === 'name' ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editHistoryFieldValue}
                                onChange={e => setEditHistoryFieldValue(e.target.value)}
                                className="flex-1 bg-zinc-800 border border-amber-500/30 rounded-lg px-3 py-1.5 text-white font-semibold text-sm focus:outline-none focus:border-amber-500"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveHistoryField(); if (e.key === 'Escape') setEditingHistoryField(null); }}
                              />
                              <button onClick={handleSaveHistoryField} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingHistoryField(null)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-zinc-800"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-white font-semibold uppercase truncate text-lg">{client.name}</span>
                              <button
                                onClick={() => { setEditingHistoryField({ clientId: client.id, field: 'name', currentValue: client.name }); setEditHistoryFieldValue(client.name); }}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-600 hover:text-amber-400 transition-all shrink-0"
                                title="Modifier le nom"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-emerald-400 font-semibold text-lg shrink-0">{client.totalSpent}€</span>
                    </div>
                    {/* Ligne 2: Apporteur + Zone + Serveur */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Apporteur éditable */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-600 text-xs font-medium uppercase">Apporteur:</span>
                        {editingHistoryField?.clientId === client.id && editingHistoryField.field === 'apporteur' ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editHistoryFieldValue}
                              onChange={e => setEditHistoryFieldValue(e.target.value)}
                              className="bg-zinc-800 border border-amber-500/30 rounded-lg px-2 py-1 text-white text-xs w-32 focus:outline-none focus:border-amber-500"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveHistoryField(); if (e.key === 'Escape') setEditingHistoryField(null); }}
                            />
                            <button onClick={handleSaveHistoryField} className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingHistoryField(null)} className="p-1 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-zinc-800"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <span className="text-zinc-400 text-xs">{client.businessProvider || '-'}</span>
                            <button
                              onClick={() => { setEditingHistoryField({ clientId: client.id, field: 'apporteur', currentValue: client.businessProvider || '' }); setEditHistoryFieldValue(client.businessProvider || ''); }}
                              className="p-1 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-600 hover:text-amber-400 transition-all"
                              title="Modifier l'apporteur"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                      {/* Zone */}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border uppercase ${zone === 'bar' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                        {zone === 'bar' ? 'Lounge' : 'Club'}
                      </span>
                      {/* Serveur */}
                      {waiter && (
                        <span className="text-xs font-medium bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">
                          {waiter.firstName}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- ONGLET ARCHIVES --- */}
      {activeTab === 'archives' && (
        <div className="fade-in-up space-y-6">
          {!selectedArchive ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-white uppercase tracking-tighter">Historique des Soirées</h3>
                <div className="gold-line flex-1 opacity-20"></div>
              </div>
              {/* Filtre par mois */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => navigateMonth(-1)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-800 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-zinc-400" />
                </button>
                <span className="text-white font-medium tracking-wide min-w-[200px] text-center capitalize">{filterMonthLabel}</span>
                <button onClick={() => navigateMonth(1)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-800 transition-colors">
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              {filteredPastEvents.length === 0 ? (
                <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-medium text-sm">
                  Aucune archive ce mois
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPastEvents.map((event, idx) => (
                    <div key={event.id} style={{ animationDelay: `${idx * 50}ms` }} className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800 hover:border-zinc-700 transition-all group fade-in-up">
                      <div onClick={() => setSelectedArchive(event)} className="cursor-pointer">
                        <h4 className="text-lg font-semibold text-white uppercase">{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                        <div className="flex items-center gap-4 mt-4">
                          <div>
                            <p className="text-2xl font-semibold text-emerald-500">{event.totalRevenue?.toFixed(0) || 0}€</p>
                            <p className="text-xs text-zinc-600 font-medium">CA Total</p>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold text-zinc-400">{event.clientCount || 0}</p>
                            <p className="text-xs text-zinc-600 font-medium">Clients</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                        <button onClick={(e) => { e.stopPropagation(); generatePDFReport(event); }} className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-xl font-medium text-xs hover:bg-red-600/30 transition-all">
                          <Download className="w-3 h-3" /> PDF
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); generateExcelReport(event); }} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-xl font-medium text-xs hover:bg-emerald-600/30 transition-all">
                          <FileSpreadsheet className="w-3 h-3" /> Excel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedArchive(null)} className="text-zinc-400 font-medium text-xs flex items-center gap-2">
                  ← Retour aux archives
                </button>
                <div className="flex gap-2">
                  <button onClick={() => generateExcelReport(selectedArchive)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all text-xs font-medium">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={() => generatePDFReport(selectedArchive)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all text-xs font-medium">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800">
                <p className="text-xs text-zinc-400/60 font-medium">{new Date(selectedArchive.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter mt-1">{selectedArchive.name || 'Soirée Deflower'}</h3>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <p className="text-3xl font-semibold text-emerald-500">{selectedArchive.totalRevenue?.toFixed(0) || 0}€</p>
                    <p className="text-xs text-zinc-500 font-medium">CA Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-semibold text-zinc-400">{selectedArchive.clientCount || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium">Clients</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-semibold text-indigo-400">{selectedArchive.orderCount || 0}</p>
                    <p className="text-xs text-zinc-500 font-medium">Commandes</p>
                  </div>
                </div>
              </div>

              {selectedArchive.detailedHistory && selectedArchive.detailedHistory.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800">
                  <h4 className="text-lg font-semibold text-white uppercase tracking-tighter mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-zinc-400" /> Détail par Client
                  </h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto no-scrollbar">
                    {selectedArchive.detailedHistory.map((entry: any, index: number) => (
                      <div key={index} className="bg-zinc-800 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-zinc-400 font-semibold">T{entry.tableNumber}</span>
                            <span className="text-white font-semibold uppercase">{entry.clientName}</span>
                          </div>
                          <span className="text-emerald-500 font-semibold">{entry.totalAmount?.toFixed(0) || 0}€</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500">Serveur: {entry.waiterName || '-'}</span>
                          {editingApporteur && editingApporteur.name === entry.clientName ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingApporteur.value}
                                onChange={(e) => setEditingApporteur({ ...editingApporteur, value: e.target.value.toUpperCase() })}
                                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs w-28 outline-none focus:border-white"
                                placeholder="APPORTEUR"
                                autoFocus
                              />
                              <button onClick={handleSaveApporteur} className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition-all">
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingApporteur(null)} className="p-1.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingApporteur({ name: entry.clientName, value: entry.apporteur || '' })}
                              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-all font-medium"
                            >
                              <Edit3 className="w-3 h-3" />
                              {entry.apporteur || 'Ajouter apporteur'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- ONGLET RÉSERVATIONS --- */}
      {activeTab === 'reservations' && (
        <div className="animate-in fade-in duration-500">
          <ReservationsManager />
        </div>
      )}

      {/* --- ONGLET CLIENTS HUB --- */}
      {activeTab === 'clients' && (
        <div className="animate-in fade-in duration-500">
          <Suspense fallback={<div className="p-8 text-center text-white/30">Chargement...</div>}>
            <HubClientsPage />
          </Suspense>
        </div>
      )}

      {/* --- MODAL ASSIGN TABLE --- */}
      {/* 🔧 FIX: Serveur maintenant OPTIONNEL */}
      {showAssignModal && clientToProcess && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 p-10 rounded-t-xl sm:rounded-xl w-full max-w-md h-[85vh] flex flex-col border-t border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">Installer Client</h3>
                <p className="text-xs font-medium text-zinc-400 uppercase truncate">{clientToProcess.name}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>

            {/* 🆕 Message explicatif */}
            <div className="mb-4 p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Le serveur est optionnel. Si non sélectionné, les chefs de rang pourront récupérer ce client depuis leur liste.</span>
            </div>

            {/* 🔧 Label modifié : "optionnel" */}
            <select 
              value={selectedWaiterId} 
              onChange={e => setSelectedWaiterId(e.target.value)} 
              className="w-full bg-zinc-800 border-2 border-zinc-800 py-4 px-6 rounded-xl text-white font-medium outline-none focus:border-white appearance-none cursor-pointer mb-4"
            >
              <option value="">-- Serveur (optionnel) --</option>
              {waiters.map(w => (<option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>))}
            </select>

            <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-1 no-scrollbar">
              {availableTables.length === 0 ? (
                <p className="text-center text-zinc-600 py-10">Aucune table disponible</p>
              ) : (
                availableTables.map(t => (
                  <button key={t.id} onClick={() => setTargetTableId(t.id)} className={`w-full py-7 px-8 rounded-xl font-medium text-3xl flex justify-between items-center border-4 transition-all ${targetTableId === t.id ? 'bg-white border-zinc-700 text-black' : 'bg-zinc-800 border-transparent text-zinc-600'}`}>
                      <span>T{t.number}</span>
                      <span className="text-sm opacity-50">{t.capacity} places</span>
                  </button>
                ))
              )}
            </div>

            <div className="pt-8 border-t border-zinc-800">
              {/* 🔧 FIX: Bouton disabled seulement si pas de table (serveur optionnel) */}
              <button 
                onClick={handleAssignSubmit} 
                disabled={!targetTableId} 
                className="w-full bg-emerald-600 disabled:opacity-30 py-8 rounded-xl font-medium text-3xl text-white active:scale-95 transition-all"
              >
                {selectedWaiterId ? 'Installer' : 'Placer à table'}
              </button>
              {!selectedWaiterId && targetTableId && (
                <p className="text-center text-amber-400/60 text-xs mt-3 font-medium">
                  Sans serveur → Les chefs de rang le verront dans "À récupérer"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TRANSFER TABLE --- */}
      {showTransferModal && clientToProcess && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 p-10 rounded-t-xl sm:rounded-xl w-full max-w-md h-[85vh] flex flex-col border-t border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">Transférer Client</h3>
                <p className="text-xs font-medium text-zinc-400 uppercase truncate">{clientToProcess.name}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-1 no-scrollbar">
              {availableTables.map(t => (
                <button key={t.id} onClick={() => setTargetTableId(t.id)} className={`w-full py-7 px-8 rounded-xl font-medium text-3xl flex justify-between items-center border-4 transition-all ${targetTableId === t.id ? 'bg-white border-zinc-700 text-black' : 'bg-zinc-800 border-transparent text-zinc-600'}`}>
                  <span>T{t.number}</span>
                </button>
              ))}
            </div>
            <div className="pt-8 border-t border-zinc-800">
              <button onClick={handleTransferSubmit} disabled={!targetTableId} className="w-full bg-emerald-600 disabled:opacity-30 py-8 rounded-xl font-medium text-3xl text-white active:scale-95 transition-all">Transférer</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TABLE LIBRE --- */}
      <FreeTableModal
        isOpen={!!freeTableForAction}
        onClose={() => setFreeTableForAction(null)}
        table={freeTableForAction}
        pendingClients={pendingClientsForTable}
        onAssignExisting={handleFreeTableAssignExisting}
        onCreateClient={handleFreeTableCreateClient}
        waiters={waiters}
      />

      {/* --- MODAL LIER UNE TABLE --- */}
      {showLinkTableModal && clientToLink && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-xl sm:rounded-xl p-10 w-full max-w-md h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-semibold text-white uppercase tracking-tighter">Lier une Table</h3>
                <p className="text-zinc-400 text-xs font-medium uppercase">{clientToLink.name}</p>
              </div>
              <button onClick={() => { setShowLinkTableModal(false); setClientToLink(null); }} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-1 no-scrollbar">
              {availableTables.length === 0 ? (
                <p className="text-center text-zinc-600 py-10 font-medium">Aucune table disponible</p>
              ) : (
                availableTables.map(t => (
                  <button key={t.id} onClick={() => setLinkTargetTableId(t.id)} className={`w-full py-6 px-8 rounded-xl font-medium text-2xl flex justify-between items-center border-2 transition-all ${linkTargetTableId === t.id ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                    <span>T{t.number}</span>
                    <span className="text-sm opacity-50">{t.capacity} places</span>
                  </button>
                ))
              )}
            </div>
            <div className="pt-8 border-t border-zinc-800">
              <button onClick={handleLinkTableSubmit} disabled={!linkTargetTableId} className="w-full bg-blue-600 disabled:opacity-30 py-6 rounded-xl font-medium text-xl text-white active:scale-95 transition-all">Lier la Table</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL EDIT CLIENT NAME --- */}
      {editingClient && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 p-8 rounded-xl w-full max-w-md border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white uppercase tracking-tighter">Modifier Client</h3>
              <button onClick={() => setEditingClient(null)} className="bg-zinc-800 p-3 rounded-full text-zinc-600"><X /></button>
            </div>
            <input 
              type="text" 
              value={editNameValue} 
              onChange={(e) => setEditNameValue(e.target.value.toUpperCase())} 
              className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold text-xl uppercase outline-none focus:border-white" 
              autoFocus 
            />
            <button onClick={handleUpdateName} disabled={!editNameValue.trim()} className="w-full mt-6 bg-amber-600 disabled:opacity-30 py-5 rounded-xl font-medium text-lg text-white active:scale-95 transition-all">Enregistrer</button>
          </div>
        </div>
      )}

      {/* --- MODAL DÉMARRER SOIRÉE --- */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md">
            <h3 className="text-2xl font-semibold text-white uppercase mb-8">Démarrer la Soirée</h3>
            <div className="space-y-4">
              <input type="date" value={startData.date} onChange={e => setStartData({...startData, date: e.target.value})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold outline-none focus:border-white" />
              <input type="text" placeholder="NOM DE LA SOIRÉE (optionnel)" value={startData.name} onChange={e => setStartData({...startData, name: e.target.value.toUpperCase()})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-medium outline-none focus:border-white" />
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowStartModal(false)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium active:scale-95 transition-all">Annuler</button>
              <button onClick={handleStartEvening} className="flex-1 bg-white text-black py-4 rounded-xl font-medium active:scale-95 transition-all">Démarrer</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DOUBLE CONFIRMATION CLÔTURER SOIRÉE --- */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-950 border border-red-500/20 rounded-xl p-10 w-full max-w-md text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-500" />
            {closeConfirmStep === 1 ? (
              <>
                <h3 className="text-2xl font-semibold text-white uppercase mb-4">Clôturer la Soirée ?</h3>
                <p className="text-zinc-400 mb-8">Cette action archivera toutes les données. Assurez-vous que tous les clients ont été encaissés.</p>
                <div className="flex gap-4">
                  <button onClick={handleCancelClose} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium active:scale-95 transition-all">Annuler</button>
                  <button onClick={handleCloseEveningStep1} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-medium active:scale-95 transition-all">Confirmer</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-semibold text-red-500 uppercase mb-4">Êtes-vous sûre ?</h3>
                <p className="text-zinc-400 mb-8">Cette action est <span className="text-red-500 font-semibold">IRRÉVERSIBLE</span>. Toutes les données seront archivées et la soirée sera définitivement clôturée.</p>
                <div className="flex gap-4">
                  <button onClick={handleCancelClose} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium active:scale-95 transition-all">Annuler</button>
                  <button onClick={handleCloseEveningConfirm} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-medium active:scale-95 transition-all animate-pulse">Clôturer définitivement</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostessDashboard;