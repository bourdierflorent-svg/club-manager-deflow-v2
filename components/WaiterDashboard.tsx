/**
 * 📍 components/WaiterDashboard.tsx
 * Dashboard principal des chefs de rang
 * 
 * VERSION 2.1 CORRIGÉE:
 * - Fix récupération client avec table déjà assignée
 * - Tables disponibles incluent la table actuelle du client
 */

import React, { useState, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { useStore } from '../store/index';
import { Client, Table, OrderStatus, TableStatus, UserRole } from '../src/types';
import { getTableZone } from '../src/utils';

// ============================================
// 📦 IMPORTS - COMPOSANTS UI
// ============================================
import { StatCard, TableCard, ClientCard, EmptyState } from './ui';
import TableMap from './TableMap';
import ReservationsManager from './ReservationsManager';
const HubClientsPage = lazy(() => import('./HubClientsPage'));

// ============================================
// 📦 IMPORTS - MODALS
// ============================================
import {
  TableSelectionModal,
  WaiterSelectionModal,
  ClientDetailModal,
  OrderModal,
  NewClientModal,
  FreeTableModal,
} from './modals';

// ============================================
// 📦 IMPORTS - HOOKS
// ============================================
import { useWaiterClientActions } from '../src/hooks/useClientActions';
import {
  useWaiterTables,
  useWaiterSettledRevenue,
  useWaiterPendingRevenue,
  useAvailableTables,
  useActiveWaiters,
} from '../src/hooks/useCalculations';

// ============================================
// 📦 IMPORTS - ICÔNES
// ============================================
import {
  TrendingUp, Clock, ShieldAlert, Zap, MapPin, History,
  ClipboardList, UserPlus, UserCheck, StickyNote, Calendar,
  Pencil, Trash2, XCircle, Check, X, Users, Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================
// 📍 TYPES
// ============================================
type TabType = 'tables' | 'available' | 'map' | 'clients' | 'history' | 'recap' | 'reservations';

type ModalType = 
  | 'none'
  | 'newClient'
  | 'clientDetail'
  | 'order'
  | 'assign'
  | 'transfer'
  | 'handover'
  | 'linkTable';

// ============================================
// 🎯 COMPOSANT PRINCIPAL
// ============================================
const WaiterDashboard: React.FC = () => {
  // ========== STORE ==========
  const currentUser = useStore(state => state.currentUser);
  const clients = useStore(state => state.clients);
  const tables = useStore(state => state.tables);
  const orders = useStore(state => state.orders);
  const products = useStore(state => state.products);

  // ========== HOOKS CUSTOM ==========
  const {
    handleCreateClient,
    handleAssignClient,
    handleTransferClient,
    handleHandoverClient,
    handleLinkTable,
    handleUnlinkTable,
    handleUnassignClient,
    handleSettlePayment,
    handleFreeTable,
  } = useWaiterClientActions();

  const myTables = useWaiterTables();
  const mySettledRevenue = useWaiterSettledRevenue();
  const myPendingRevenue = useWaiterPendingRevenue();
  const availableTables = useAvailableTables();
  const activeWaiters = useActiveWaiters();

  // CA SAW : CA global des CDR (zone club uniquement)
  const sawRevenue = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== OrderStatus.SERVED && o.status !== OrderStatus.SETTLED) return false;
      const client = clients.find(c => c.id === o.clientId);
      const table = tables.find(t => t.id === (o.tableId || client?.tableId));
      const zone = table ? getTableZone(table.number, table.zone) : 'club';
      return zone !== 'bar';
    }).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
  }, [orders, clients, tables]);

  // ========== STORE ACTIONS ==========
  const removeItemFromServedOrder = useStore(state => state.removeItemFromServedOrder);
  const updateServedItemPrice = useStore(state => state.updateServedItemPrice);
  const cancelOrder = useStore(state => state.cancelOrder);
  const reopenClient = useStore(state => state.reopenClient);
  const createClient = useStore(state => state.createClient);
  const updateClientName = useStore(state => state.updateClientName);
  const updateClientBusinessProvider = useStore(state => state.updateClientBusinessProvider);
  const users = useStore(state => state.users);
  const addNotification = useStore(state => state.addNotification);

  // ========== ÉTATS ==========
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isSelectedTableLinked, setIsSelectedTableLinked] = useState(false);

  // État pour table libre
  const [freeTableForAction, setFreeTableForAction] = useState<Table | null>(null);

  // États pour édition de commandes servies
  const [editingPrice, setEditingPrice] = useState<{ orderId: string; itemId: string; currentPrice: number } | null>(null);
  const [newPriceValue, setNewPriceValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [removingItem, setRemovingItem] = useState<{ orderId: string; itemId: string; itemName: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  // États pour édition nom client / apporteur (clients encaissés)
  const [editingClientField, setEditingClientField] = useState<{ clientId: string; field: 'name' | 'apporteur'; currentValue: string } | null>(null);
  const [editFieldValue, setEditFieldValue] = useState('');


  // ========== DONNÉES CALCULÉES ==========
  const availableClients = useMemo(() => 
    clients.filter(c => c.status !== 'closed' && (!c.tableId || !c.waiterId)),
    [clients]
  );

  const myOrdersHistory = useMemo(() =>
    orders
      .filter(o => o.waiterId === currentUser?.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50),
    [orders, currentUser?.id]
  );

  // Clients encaissés du chef de rang
  const myClosedClients = useMemo(() =>
    clients.filter(c => c.status === 'closed' && c.waiterId === currentUser?.id),
    [clients, currentUser?.id]
  );

  // Récap Bouteilles : total de toutes les bouteilles vendues (tous CDR)
  const allBottles = useMemo(() => {
    const itemMap: Record<string, { name: string; size: string; quantity: number }> = {};
    orders
      .filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .forEach(order => {
        order.items.forEach(item => {
          const key = `${item.productName}-${item.size}`;
          if (!itemMap[key]) {
            itemMap[key] = { name: item.productName, size: item.size, quantity: 0 };
          }
          itemMap[key].quantity += item.quantity;
        });
      });
    return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
  }, [orders]);

  // ==========================================
  // 🔧 FIX: Tables disponibles pour assignation
  // ==========================================
  // Inclut la table actuelle du client si elle existe
  // (pour permettre la récupération sans changer de table)
  const tablesForAssign = useMemo(() => {
    // Si pas de client sélectionné ou client sans table, retourner les tables dispo
    if (!selectedClient?.tableId) {
      return availableTables;
    }
    
    // Trouver la table actuelle du client
    const clientCurrentTable = tables.find(t => t.id === selectedClient.tableId);
    
    // Si la table existe et n'est pas déjà dans availableTables, l'ajouter en premier
    if (clientCurrentTable && !availableTables.find(t => t.id === clientCurrentTable.id)) {
      return [clientCurrentTable, ...availableTables];
    }
    
    return availableTables;
  }, [selectedClient, tables, availableTables]);

  const getClientTotal = useCallback((client: Client): number => {
    if (client.status === 'closed') return client.totalSpent;
    return orders
      .filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  // ========== HANDLERS - COMMANDES SERVIES ==========
  const handleConfirmPriceEdit = useCallback(async () => {
    if (!editingPrice || !editReason.trim() || !newPriceValue) return;
    const price = parseFloat(newPriceValue);
    if (isNaN(price) || price < 0) return;
    await updateServedItemPrice(editingPrice.orderId, editingPrice.itemId, price, editReason.trim());
    setEditingPrice(null);
    setNewPriceValue('');
    setEditReason('');
  }, [editingPrice, newPriceValue, editReason, updateServedItemPrice]);

  const handleConfirmRemoveItem = useCallback(async () => {
    if (!removingItem || !removeReason.trim()) return;
    await removeItemFromServedOrder(removingItem.orderId, removingItem.itemId);
    setRemovingItem(null);
    setRemoveReason('');
  }, [removingItem, removeReason, removeItemFromServedOrder]);

  const handleConfirmCancelOrder = useCallback(async () => {
    if (!cancellingOrderId || !cancelReason.trim()) return;
    await cancelOrder(cancellingOrderId, cancelReason.trim());
    setCancellingOrderId(null);
    setCancelReason('');
  }, [cancellingOrderId, cancelReason, cancelOrder]);

  const handleSaveClientField = useCallback(async () => {
    if (!editingClientField || !editFieldValue.trim()) return;
    if (editingClientField.field === 'name') {
      await updateClientName(editingClientField.clientId, editFieldValue.trim());
    } else {
      await updateClientBusinessProvider(editingClientField.clientId, editFieldValue.trim());
    }
    setEditingClientField(null);
    setEditFieldValue('');
  }, [editingClientField, editFieldValue, updateClientName, updateClientBusinessProvider]);

  // ========== HANDLERS - MODALS ==========
  const closeModal = useCallback(() => {
    setActiveModal('none');
    setSelectedClient(null);
    setSelectedTable(null);
    setIsSelectedTableLinked(false);
  }, []);

  const closeFreeTableModal = useCallback(() => {
    setFreeTableForAction(null);
  }, []);

  const openClientDetail = useCallback((client: Client, table?: Table, isLinked: boolean = false) => {
    setSelectedClient(client);
    setSelectedTable(table || null);
    setIsSelectedTableLinked(isLinked);
    setActiveModal('clientDetail');
  }, []);

  // ========== HANDLERS - ACTIONS ==========
  const handleSmartRecovery = useCallback((client: Client) => {
    setSelectedClient(client);
    setActiveModal('assign');
  }, []);

  const handleCreateClientSubmit = useCallback((name: string, apporteur?: string) => {
    if (!currentUser) return;
    handleCreateClient(name, apporteur, undefined, currentUser.id);
    closeModal();
  }, [currentUser, handleCreateClient, closeModal]);

  const handleAssignSubmit = useCallback(async (tableId: string) => {
    if (!selectedClient || !currentUser) return;
    // Fermer immédiatement le modal — le résultat est communiqué via notification
    closeModal();
    const success = await handleAssignClient(selectedClient.id, tableId, currentUser.id);
    if (success) {
      setActiveTab('tables');
    }
  }, [selectedClient, currentUser, handleAssignClient, closeModal]);

  const handleTransferSubmit = useCallback(async (tableId: string) => {
    if (!selectedClient) return;
    const success = await handleTransferClient(selectedClient.id, tableId);
    if (success) closeModal();
  }, [selectedClient, handleTransferClient, closeModal]);

  const handleHandoverSubmit = useCallback(async (waiterId: string) => {
    if (!selectedClient) return;
    await handleHandoverClient(selectedClient.id, waiterId);
    closeModal();
  }, [selectedClient, handleHandoverClient, closeModal]);

  const handleLinkTableSubmit = useCallback(async (tableId: string) => {
    if (!selectedClient) return;
    await handleLinkTable(selectedClient.id, tableId);
    closeModal();
  }, [selectedClient, handleLinkTable, closeModal]);

  const handleUnassignAction = useCallback(async () => {
    if (!selectedClient) return;
    
    // Si c'est une table liée, on la délie seulement
    if (isSelectedTableLinked && selectedTable) {
      await handleUnlinkTable(selectedClient.id, selectedTable.id);
    } else {
      // Sinon, on désassocie complètement le client
      await handleUnassignClient(selectedClient.id);
    }
    closeModal();
  }, [selectedClient, selectedTable, isSelectedTableLinked, handleUnlinkTable, handleUnassignClient, closeModal]);

  const handleSettleAction = useCallback(async () => {
    if (!selectedClient) return;
    try {
      await handleSettlePayment(selectedClient.id);
      closeModal();
    } catch {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
    }
  }, [selectedClient, handleSettlePayment, closeModal, addNotification]);

  const handleFreeTableAction = useCallback(async () => {
    if (!selectedClient?.tableId) return;
    await handleFreeTable(selectedClient.tableId);
    closeModal();
  }, [selectedClient?.tableId, handleFreeTable, closeModal]);

  const handleReopenAction = useCallback(async () => {
    if (!selectedClient) return;
    await reopenClient(selectedClient.id);
    closeModal();
  }, [selectedClient, reopenClient, closeModal]);

  // 🔧 FIX: Priorité aux clients actifs pour éviter qu'un ancien client encaissé masque le nouveau
  const handleTableClickOnMap = useCallback((table: Table) => {
    const client = clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      (c.status === 'assigned' || c.status === 'pending')
    ) || clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      c.status === 'closed'
    );
    if (client) {
      const isLinked = client.tableId !== table.id && client.linkedTableIds?.includes(table.id);
      openClientDetail(client, table, isLinked || false);
    } else if (table.status === TableStatus.AVAILABLE) {
      setFreeTableForAction(table);
    }
  }, [clients, openClientDetail]);

  const handleFreeTableCreateClient = useCallback((name: string, apporteur?: string, waiterId?: string) => {
    if (!freeTableForAction || !currentUser) return;
    createClient(name, apporteur, freeTableForAction.id, waiterId || currentUser.id);
    addNotification({ type: 'success', title: 'CLIENT INSTALLE', message: `${name} sur ${freeTableForAction.number.toUpperCase().startsWith('BAR') ? freeTableForAction.number : 'Table ' + freeTableForAction.number}` });
    setFreeTableForAction(null);
  }, [freeTableForAction, currentUser, createClient, addNotification]);

  const handleFreeTableAssignExisting = useCallback((clientId: string, waiterId?: string) => {
    if (!freeTableForAction || !currentUser) return;
    handleAssignClient(clientId, freeTableForAction.id, waiterId || currentUser.id);
    const client = clients.find(c => c.id === clientId);
    addNotification({ type: 'success', title: 'CLIENT INSTALLÉ', message: `${client?.name || ''} → ${freeTableForAction.number.toUpperCase().startsWith('BAR') ? freeTableForAction.number : 'Table ' + freeTableForAction.number}` });
    setFreeTableForAction(null);
  }, [freeTableForAction, currentUser, handleAssignClient, clients, addNotification]);

  // Clients en attente (pas de table)
  const pendingClientsForTable = useMemo(() =>
    clients.filter(c => c.status === 'pending' && !c.tableId),
    [clients]
  );

  // ========== RENDER HELPERS ==========
  const renderTableIcon = useCallback((tableNumber: string) => {
    const isBar = tableNumber.toUpperCase().startsWith('BAR');
    if (isBar) {
      return (
        <div className="flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] text-zinc-500 mb-0.5">BAR</span>
          <span className="text-xl md:text-2xl font-semibold">{tableNumber.replace(/BAR/i, '').trim()}</span>
        </div>
      );
    }
    return <span className="text-xl md:text-3xl font-semibold">T{tableNumber}</span>;
  }, []);

  // ========== EXPORT PDF BOUTEILLES ==========
  const exportBottlesPDF = useCallback(() => {
    if (allBottles.length === 0) return;

    const doc = new jsPDF();
    const totalBottles = allBottles.reduce((acc, i) => acc + i.quantity, 0);
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DEFLOWER - Recap Bouteilles', 14, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(today, 14, 30);
    doc.text(`Total: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, 38);

    autoTable(doc, {
      head: [['Bouteille', 'Taille', 'Quantite']],
      body: allBottles.map(item => [item.name, item.size, `${item.quantity}`]),
      startY: 46,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: {
        fillColor: [30, 30, 30] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
      },
      alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, finalY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Genere le ${today} a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      14,
      doc.internal.pageSize.height - 10
    );

    doc.save(`Recap_Bouteilles_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [allBottles]);

  // ========== RENDER ==========
  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ===== CA SAW ===== */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
        <p className="text-2xl font-semibold text-amber-400 tabular-nums">{sawRevenue.toFixed(0)}€</p>
        <p className="text-xs text-zinc-500 mt-1">CA SAW</p>
      </div>
      {/* ===== STATS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={TrendingUp} value={`${mySettledRevenue.toFixed(0)}€`} label="CA Encaissé" color="emerald" />
        <StatCard icon={Clock} value={`${myPendingRevenue.toFixed(0)}€`} label="CA En Attente" color="amber" />
        <StatCard icon={ShieldAlert} value={myTables.length} label="Tables Actives" color="gold" />
        <StatCard icon={Zap} value={availableClients.length} label="À Récupérer" color="indigo" />
      </div>

      {/* ===== TABS ===== */}
      <div className="flex border-b border-zinc-800 overflow-x-auto no-scrollbar gap-1">
        {[
          { id: 'tables' as TabType, icon: ShieldAlert, label: 'Mes Tables', count: myTables.length },
          { id: 'available' as TabType, icon: UserCheck, label: 'Libres', count: availableClients.length },
          { id: 'map' as TabType, icon: MapPin, label: 'Plan' },
          { id: 'clients' as TabType, icon: Users, label: 'Clients' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label} {tab.count !== undefined && <span className="text-zinc-600">({tab.count})</span>}
          </button>
        ))}
        <button onClick={() => setActiveModal('newClient')} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors whitespace-nowrap border-b-2 border-transparent -mb-px">
          <UserPlus className="w-3.5 h-3.5" /> Creer
        </button>
        {[
          { id: 'history' as TabType, icon: History, label: 'Historique' },
          { id: 'recap' as TabType, icon: ClipboardList, label: 'Recap Bouteilles' },
          { id: 'reservations' as TabType, icon: Calendar, label: 'Resa' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.id ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: MES TABLES ===== */}
      {activeTab === 'tables' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {myTables.length === 0 ? (
            <EmptyState message="Aucune table assignée" size="lg" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
              {myTables.map(table => {
                const client = clients.find(c => c.tableId === table.id && c.waiterId === currentUser?.id && c.status !== 'closed');
                const linkedClient = clients.find(c => c.linkedTableIds?.includes(table.id) && c.waiterId === currentUser?.id);
                const mainClient = client || linkedClient;
                if (!mainClient) return null;
                return (
                  <TableCard
                    key={table.id}
                    table={table}
                    client={mainClient}
                    isLinkedTable={!client && !!linkedClient}
                    onClick={openClientDetail}
                    renderIcon={renderTableIcon}
                    total={getClientTotal(mainClient)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: LIBRES ===== */}
      {activeTab === 'available' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {availableClients.length === 0 ? (
            <EmptyState message="Aucun client à récupérer" size="lg" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {availableClients.map(client => {
                // 🔧 FIX: Afficher le numéro de table si déjà assignée
                const clientTable = client.tableId ? tables.find(t => t.id === client.tableId) : null;
                const tableInfo = clientTable ? ` (T${clientTable.number})` : '';
                
                return (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onPrimaryAction={handleSmartRecovery}
                    primaryActionLabel={
                      client.tableId 
                        ? `Récupérer${tableInfo}` 
                        : (client.waiterId === currentUser?.id ? 'Installer' : 'Récupérer')
                    }
                    primaryActionColor={client.waiterId === currentUser?.id ? 'blue' : 'emerald'}
                    showArrivalTime
                    isAssignedToMe={client.waiterId === currentUser?.id}
                    variant="compact"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: PLAN ===== */}
      {activeTab === 'map' && (
        <div className="animate-in fade-in duration-300">
          <TableMap tables={tables} clients={clients} onTableClick={handleTableClickOnMap} currentUserId={currentUser?.id} />
        </div>
      )}

      {/* ===== TAB: CLIENTS ===== */}
      {activeTab === 'clients' && (
        <div className="animate-in fade-in duration-300">
          <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>}>
            <HubClientsPage />
          </Suspense>
        </div>
      )}

      {/* ===== TAB: HISTORIQUE ===== */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* --- Section clients encaissés --- */}
          {myClosedClients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-emerald-400">Clients encaisses</h3>
                <div className="flex-1 h-px bg-zinc-800"></div>
              </div>
              {myClosedClients.map(client => {
                const table = tables.find(t => t.id === client.tableId);
                const clientOrders = orders.filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED));
                const total = client.totalSpent;
                return (
                  <div key={client.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-zinc-400 font-medium text-base shrink-0">{table?.number?.toUpperCase().startsWith('BAR') ? table.number : `T${table?.number || '?'}`}</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {editingClientField?.clientId === client.id && editingClientField.field === 'name' ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editFieldValue}
                                onChange={e => setEditFieldValue(e.target.value)}
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-zinc-500"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveClientField(); if (e.key === 'Escape') setEditingClientField(null); }}
                              />
                              <button onClick={handleSaveClientField} className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingClientField(null)} className="p-1 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-zinc-700"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-white font-medium truncate">{client.name}</span>
                              <button
                                onClick={() => { setEditingClientField({ clientId: client.id, field: 'name', currentValue: client.name }); setEditFieldValue(client.name); }}
                                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
                                title="Modifier le nom"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-center sm:self-auto">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Encaisse</span>
                        <span className="text-emerald-400 font-semibold tabular-nums">{total}€</span>
                      </div>
                    </div>
                    {/* Apporteur */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-zinc-600 text-xs">Apporteur:</span>
                      {editingClientField?.clientId === client.id && editingClientField.field === 'apporteur' ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editFieldValue}
                            onChange={e => setEditFieldValue(e.target.value)}
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-white text-xs focus:outline-none focus:border-zinc-500"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveClientField(); if (e.key === 'Escape') setEditingClientField(null); }}
                          />
                          <button onClick={handleSaveClientField} className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingClientField(null)} className="p-1 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-zinc-700"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-zinc-400 text-xs">{client.businessProvider || '-'}</span>
                          <button
                            onClick={() => { setEditingClientField({ clientId: client.id, field: 'apporteur', currentValue: client.businessProvider || '' }); setEditFieldValue(client.businessProvider || ''); }}
                            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors"
                            title="Modifier l'apporteur"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                    {/* Résumé commandes */}
                    <div className="text-zinc-600 text-xs mt-2">{clientOrders.length} commande{clientOrders.length > 1 ? 's' : ''} servie{clientOrders.length > 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* --- Section commandes --- */}
          {myOrdersHistory.length === 0 && myClosedClients.length === 0 ? (
            <EmptyState message="Aucune commande" size="lg" />
          ) : myOrdersHistory.length > 0 && (
            <>
            {myClosedClients.length > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <h3 className="text-sm font-medium text-zinc-500">Commandes</h3>
                <div className="flex-1 h-px bg-zinc-800"></div>
              </div>
            )}
            <div className="space-y-3">
              {myOrdersHistory.map(order => {
                const client = clients.find(c => c.id === order.clientId);
                const table = tables.find(t => t.id === order.tableId);
                const isMyOrder = order.waiterId === currentUser?.id;
                const isServed = order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED;
                const canEdit = isMyOrder && isServed;
                const canCancel = isMyOrder && (isServed || order.status === OrderStatus.PENDING);
                return (
                  <div key={order.id} className={`bg-zinc-900 border rounded-xl p-4 ${isServed ? 'border-emerald-500/20' : order.status === OrderStatus.PENDING ? 'border-amber-500/20' : 'border-red-500/20'}`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 font-medium">{table?.number?.toUpperCase().startsWith('BAR') ? table.number : `T${table?.number || '?'}`}</span>
                        <span className="text-white font-medium truncate">{client?.name || '?'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${isServed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : order.status === OrderStatus.PENDING ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{order.status}</span>
                        <span className="text-zinc-600 text-xs">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {order.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm text-zinc-400">
                          <span>
                            <span className="text-zinc-300 font-medium">{item.quantity}x</span> {item.productName} <span className="text-zinc-600">({item.size})</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-300 tabular-nums">{item.subtotal}€</span>
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingPrice({ orderId: order.id, itemId: item.id, currentPrice: item.unitPrice }); setNewPriceValue(item.unitPrice.toString()); setEditReason(''); }}
                                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-amber-400 transition-colors"
                                  title="Modifier prix"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => { setRemovingItem({ orderId: order.id, itemId: item.id, itemName: item.productName }); setRemoveReason(''); }}
                                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-colors"
                                  title="Retirer article"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.note && <p className="text-amber-400/60 text-xs mt-2 italic flex items-center gap-1"><StickyNote className="w-3 h-3" /> {order.note}</p>}
                    {/* Affichage motif annulation */}
                    {order.status === OrderStatus.CANCELLED && order.cancelReason && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-red-400 text-xs font-semibold uppercase flex items-center gap-2 mb-1">
                          <XCircle className="w-3.5 h-3.5" /> Commande annulee
                        </p>
                        <p className="text-red-300/80 text-xs">Motif : {order.cancelReason}</p>
                        {order.cancelledByName && (
                          <p className="text-red-400/50 text-[10px] mt-1">
                            Par {order.cancelledByName}{order.cancelledAt ? ` - ${new Date(order.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Bouton annuler commande */}
                    {canCancel && (
                      <button
                        onClick={() => { setCancellingOrderId(order.id); setCancelReason(''); }}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Annuler la commande
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
          )}

          {/* MODAL : Modifier prix */}
          {editingPrice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditingPrice(null)}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-white font-medium text-sm">Modifier le prix</h3>
                <div>
                  <label className="text-zinc-500 text-xs block mb-1">Nouveau prix unitaire</label>
                  <input
                    type="number"
                    value={newPriceValue}
                    onChange={e => setNewPriceValue(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500/50"
                    min="0"
                    step="1"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-zinc-500 text-xs block mb-1">Motif (obligatoire)</label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    placeholder="Ex: erreur de saisie, remise..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingPrice(null)}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Annuler
                  </button>
                  <button
                    onClick={handleConfirmPriceEdit}
                    disabled={!editReason.trim() || !newPriceValue}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-black font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL : Retirer article */}
          {removingItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRemovingItem(null)}>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-white font-medium text-sm">Retirer un article</h3>
                <p className="text-zinc-400 text-sm">
                  Retirer <span className="text-white font-bold">{removingItem.itemName}</span> de cette commande ?
                </p>
                <div>
                  <label className="text-zinc-500 text-xs block mb-1">Motif (obligatoire)</label>
                  <input
                    type="text"
                    value={removeReason}
                    onChange={e => setRemoveReason(e.target.value)}
                    placeholder="Ex: erreur, client ne veut plus..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRemovingItem(null)}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Annuler
                  </button>
                  <button
                    onClick={handleConfirmRemoveItem}
                    disabled={!removeReason.trim()}
                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Retirer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL : Annuler commande */}
          {cancellingOrderId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCancellingOrderId(null)}>
              <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-red-400 font-semibold uppercase text-sm">Annuler la commande</h3>
                <p className="text-zinc-400 text-sm">
                  Cette action est irreversible. La commande sera marquee comme annulee.
                </p>
                <div>
                  <label className="text-zinc-500 text-xs block mb-1">Motif (obligatoire)</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Ex: erreur de commande, doublon..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancellingOrderId(null)}
                    className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Retour
                  </button>
                  <button
                    onClick={handleConfirmCancelOrder}
                    disabled={!cancelReason.trim()}
                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: RÉCAP ===== */}
      {activeTab === 'recap' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {allBottles.length === 0 ? (
            <EmptyState message="Aucune bouteille vendue" size="lg" />
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white uppercase">Recap Bouteilles</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    {allBottles.reduce((acc, i) => acc + i.quantity, 0)} bouteilles
                  </span>
                  <button
                    onClick={exportBottlesPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-xs font-semibold uppercase"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
              <div className="divide-y divide-zinc-800">
                {allBottles.map((item, idx) => (
                  <div key={idx} className="px-5 py-3 flex justify-between items-center">
                    <div>
                      <span className="text-white font-medium text-sm">{item.name}</span>
                      <span className="text-zinc-600 text-sm ml-2">({item.size})</span>
                    </div>
                    <span className="text-zinc-300 font-semibold tabular-nums text-sm">{item.quantity}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB: RÉSERVATIONS ===== */}
      {activeTab === 'reservations' && (
        <div className="animate-in fade-in duration-300">
          <ReservationsManager />
        </div>
      )}

      {/* ===== MODALS ===== */}
      <NewClientModal
        isOpen={activeModal === 'newClient'}
        onClose={closeModal}
        onSubmit={handleCreateClientSubmit}
      />

      <FreeTableModal
        isOpen={!!freeTableForAction}
        onClose={closeFreeTableModal}
        table={freeTableForAction}
        pendingClients={pendingClientsForTable}
        onAssignExisting={handleFreeTableAssignExisting}
        onCreateClient={handleFreeTableCreateClient}
        autoWaiterId={currentUser?.id}
      />

      <ClientDetailModal
        isOpen={activeModal === 'clientDetail'}
        client={selectedClient}
        table={selectedTable || tables.find(t => t.id === selectedClient?.tableId)}
        orders={orders}
        onClose={closeModal}
        onOpenOrder={() => setActiveModal('order')}
        onOpenTransfer={() => setActiveModal('transfer')}
        onOpenHandover={() => setActiveModal('handover')}
        onOpenLinkTable={() => setActiveModal('linkTable')}
        onUnassign={handleUnassignAction}
        onSettle={handleSettleAction}
        onFreeTable={handleFreeTableAction}
        onReopen={handleReopenAction}
        // 🔒 Permission: serveur assigné, autre CDR ou admin peut commander
        canOrder={currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.WAITER || selectedClient?.waiterId === currentUser?.id}
        // 📌 Indique si on est sur une table liée (pour afficher le bon bouton)
        isLinkedTable={isSelectedTableLinked}
      />

      <OrderModal
        isOpen={activeModal === 'order'}
        client={selectedClient}
        products={products}
        onClose={closeModal}
      />

      {/* 🔧 FIX: Utilise tablesForAssign au lieu de availableTables */}
      <TableSelectionModal
        isOpen={activeModal === 'assign'}
        variant="assign"
        tables={tablesForAssign}
        clientName={selectedClient?.name || ''}
        currentTableId={selectedClient?.tableId}
        onClose={closeModal}
        onSubmit={handleAssignSubmit}
      />

      <TableSelectionModal
        isOpen={activeModal === 'transfer'}
        variant="transfer"
        tables={availableTables}
        clientName={selectedClient?.name || ''}
        onClose={closeModal}
        onSubmit={handleTransferSubmit}
      />

      <TableSelectionModal
        isOpen={activeModal === 'linkTable'}
        variant="link"
        tables={availableTables}
        clientName={selectedClient?.name || ''}
        onClose={closeModal}
        onSubmit={handleLinkTableSubmit}
      />

      <WaiterSelectionModal
        isOpen={activeModal === 'handover'}
        waiters={activeWaiters}
        clientName={selectedClient?.name || ''}
        currentUserId={currentUser?.id}
        onClose={closeModal}
        onSubmit={handleHandoverSubmit}
      />
    </div>
  );
};

export default memo(WaiterDashboard);