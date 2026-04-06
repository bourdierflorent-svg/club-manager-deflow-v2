/**
 * 🍸 components/BarmaidDashboard.tsx
 * Dashboard minimal pour les barmaids
 * Accès uniquement à la zone BAR + commandes
 */

import React, { useState, useMemo, useCallback, memo } from 'react';
import { useStore } from '../store/index';
import { Client, Table, OrderStatus, TableStatus } from '../src/types';
import { getTableZone } from '../src/utils';

// Composants UI
import { StatCard } from './ui';
import TableMap from './TableMap';

// Modals
import { ClientDetailModal, OrderModal, FreeTableModal } from './modals';

// Icones
import { TrendingUp, Wine, Users, X, XCircle } from 'lucide-react';

// ============================================
// TYPES
// ============================================

type ModalType = 'none' | 'clientDetail' | 'order';

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const BarmaidDashboard: React.FC = () => {
  // ========== STORE ==========
  const currentUser = useStore(state => state.currentUser);
  const clients = useStore(state => state.clients);
  const tables = useStore(state => state.tables);
  const orders = useStore(state => state.orders);
  const products = useStore(state => state.products);
  const createClient = useStore(state => state.createClient);
  const assignClient = useStore(state => state.assignClient);
  const settlePayment = useStore(state => state.settlePayment);
  const freeTable = useStore(state => state.freeTable);
  const addNotification = useStore(state => state.addNotification);
  const cancelOrder = useStore(state => state.cancelOrder);

  // ========== ETATS ==========
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [freeTableForAction, setFreeTableForAction] = useState<Table | null>(null);

  // États pour annulation de commande
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // ========== DONNEES FILTREES (zone bar uniquement) ==========
  const barTables = useMemo(() =>
    tables.filter(t => getTableZone(t.number, t.zone) === 'bar'),
    [tables]
  );

  const barClients = useMemo(() =>
    clients.filter(c => {
      if (c.status === 'closed') return false;
      const table = tables.find(t => t.id === c.tableId);
      return table && getTableZone(table.number, table.zone) === 'bar';
    }),
    [clients, tables]
  );

  const barRevenue = useMemo(() =>
    orders
      .filter(o => {
        const client = clients.find(c => c.id === o.clientId);
        const table = tables.find(t => t.id === client?.tableId);
        return table && getTableZone(table.number, table.zone) === 'bar' && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
      })
      .reduce((acc, o) => acc + o.totalAmount, 0),
    [orders, clients, tables]
  );

  const activeBarTables = useMemo(() =>
    barTables.filter(t => t.status === TableStatus.OCCUPIED || t.status === TableStatus.SERVED || t.status === TableStatus.TO_PAY).length,
    [barTables]
  );

  // ========== HANDLERS ==========
  const closeModal = useCallback(() => {
    setActiveModal('none');
    setSelectedClient(null);
    setSelectedTable(null);
  }, []);

  const closeFreeTableModal = useCallback(() => {
    setFreeTableForAction(null);
  }, []);

  const openClientDetail = useCallback((client: Client, table?: Table) => {
    setSelectedClient(client);
    setSelectedTable(table || null);
    setActiveModal('clientDetail');
  }, []);

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
      openClientDetail(client, table);
    } else if (table.status === TableStatus.AVAILABLE) {
      setFreeTableForAction(table);
    }
  }, [clients, openClientDetail]);

  // --- HANDLERS FREE TABLE MODAL ---
  const handleFreeTableCreateClient = useCallback((name: string, apporteur?: string, waiterId?: string) => {
    if (!freeTableForAction) return;
    createClient(name, apporteur || '', freeTableForAction.id, waiterId || currentUser?.id || '');
    const tableLabel = freeTableForAction.number.toUpperCase().startsWith('BAR')
      ? freeTableForAction.number
      : `Table ${freeTableForAction.number}`;
    addNotification({ type: 'success', title: 'CLIENT INSTALLÉ', message: `${name} → ${tableLabel}` });
    setFreeTableForAction(null);
  }, [freeTableForAction, createClient, currentUser, addNotification]);

  const handleFreeTableAssignExisting = useCallback((clientId: string, waiterId?: string) => {
    if (!freeTableForAction || !currentUser) return;
    assignClient(clientId, freeTableForAction.id, waiterId || currentUser.id);
    const client = clients.find(c => c.id === clientId);
    addNotification({ type: 'success', title: 'CLIENT INSTALLÉ', message: `${client?.name || ''} → ${freeTableForAction.number}` });
    setFreeTableForAction(null);
  }, [freeTableForAction, currentUser, assignClient, clients, addNotification]);

  // Clients en attente (pas de table)
  const pendingClientsForTable = useMemo(() =>
    clients.filter(c => c.status === 'pending' && !c.tableId),
    [clients]
  );

  const handleSettleAction = useCallback(async () => {
    if (!selectedClient) return;
    await settlePayment(selectedClient.id);
    addNotification({ type: 'success', title: 'ENCAISSÉ', message: `${selectedClient.name} encaissé avec succès` });
    closeModal();
  }, [selectedClient, settlePayment, addNotification, closeModal]);

  const handleFreeTableAction = useCallback(async () => {
    if (!selectedClient?.tableId) return;
    await freeTable(selectedClient.tableId);
    addNotification({ type: 'success', title: 'TABLE LIBÉRÉE', message: `Table libérée avec succès` });
    closeModal();
  }, [selectedClient?.tableId, freeTable, addNotification, closeModal]);

  const handleConfirmCancelOrder = useCallback(async () => {
    if (!cancellingOrderId || !cancelReason.trim()) return;
    await cancelOrder(cancellingOrderId, cancelReason.trim());
    setCancellingOrderId(null);
    setCancelReason('');
  }, [cancellingOrderId, cancelReason, cancelOrder]);

  const handleClientCardClick = useCallback((client: Client) => {
    const table = tables.find(t => t.id === client.tableId);
    openClientDetail(client, table);
  }, [tables, openClientDetail]);

  const getClientTotal = useCallback((client: Client): number => {
    if (client.status === 'closed') return client.totalSpent;
    return orders
      .filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED))
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  // ========== RENDER ==========
  return (
    <div className="space-y-4 p-4 md:p-6 max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-zinc-800 p-3 rounded-2xl">
          <Wine className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white uppercase tracking-tighter">Bar</h1>
          <p className="text-zinc-500 text-xs font-medium">
            {currentUser?.firstName || 'Barmaid'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={Wine}
          label="Tables actives"
          value={activeBarTables}
        />
        <StatCard
          icon={Users}
          label="Clients"
          value={barClients.length}
        />
        <StatCard
          icon={TrendingUp}
          label="CA Bar"
          value={`${barRevenue.toFixed(0)}€`}
        />
      </div>

      {/* Plan de table (zone bar forcée) */}
      <TableMap
        tables={tables}
        clients={clients}
        onTableClick={handleTableClickOnMap}
        currentUserId={currentUser?.id}
        forceZone="bar"
      />

      {/* Liste des clients bar actifs */}
      {barClients.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-zinc-500 px-1">
            Clients au bar ({barClients.length})
          </h2>
          <div className="space-y-2">
            {barClients.map(client => {
              const table = tables.find(t => t.id === client.tableId);
              return (
                <div
                  key={client.id}
                  onClick={() => handleClientCardClick(client)}
                  className="bg-zinc-800 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:bg-zinc-700"
                >
                  <div>
                    <p className="font-semibold text-white text-sm uppercase">{client.name}</p>
                    <p className="text-zinc-500 text-xs font-medium">
                      {table?.number || 'Sans table'}
                    </p>
                  </div>
                  <p className="text-white font-semibold text-lg">
                    {getClientTotal(client).toFixed(0)}€
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
      <ClientDetailModal
        isOpen={activeModal === 'clientDetail'}
        client={selectedClient}
        table={selectedTable || tables.find(t => t.id === selectedClient?.tableId)}
        orders={orders}
        onClose={closeModal}
        onOpenOrder={() => setActiveModal('order')}
        onOpenTransfer={() => {}}
        onOpenHandover={() => {}}
        onOpenLinkTable={() => {}}
        onUnassign={() => {}}
        onSettle={handleSettleAction}
        onFreeTable={handleFreeTableAction}
        canOrder={true}
        canSettle={true}
        hideManagementActions={true}
        onCancelOrder={(orderId) => { setCancellingOrderId(orderId); setCancelReason(''); }}
      />

      <OrderModal
        isOpen={activeModal === 'order'}
        client={selectedClient}
        products={products}
        onClose={closeModal}
      />

      {/* MODAL TABLE LIBRE */}
      <FreeTableModal
        isOpen={!!freeTableForAction}
        onClose={closeFreeTableModal}
        table={freeTableForAction}
        pendingClients={pendingClientsForTable}
        onAssignExisting={handleFreeTableAssignExisting}
        onCreateClient={handleFreeTableCreateClient}
        autoWaiterId={currentUser?.id}
      />

      {/* MODAL : Annuler commande */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 p-4" onClick={() => setCancellingOrderId(null)}>
          <div className="bg-zinc-900 border border-red-500/20 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-red-400 font-semibold uppercase text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Annuler la commande
            </h3>
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
  );
};

export default memo(BarmaidDashboard);
