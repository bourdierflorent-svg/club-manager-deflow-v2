import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStore } from '../store/index';
import { OrderStatus, Order, UserRole, Table, Client, TableStatus } from '../src/types';
import { jsPDF } from 'jspdf';
import { 
  CheckCircle, Clock, History, AlertTriangle, X, StickyNote, Search, Filter, User as UserIcon, Trash2,
  BarChart3, LayoutGrid, TrendingUp, Receipt, MapPin, Edit3, MoreHorizontal, UserPlus, ShoppingCart,
  ArrowRightLeft, UserCheck, LogOut, RotateCw, Wallet, ChevronLeft, ChevronRight, FileText,
  Download, FileSpreadsheet, Share2
} from 'lucide-react';
import TableMap from './TableMap';
import { formatCurrency, CHART_COLORS, getTableZone } from '../src/utils';
import { useExport } from '../src/hooks/useExport';
import { OrderModal, FreeTableModal } from './modals';

const CaisseTab = lazy(() => import('./CaisseTab'));
const InvoicesManager = lazy(() => import('./InvoicesManager'));

const ManagerDashboard: React.FC = () => {
  const orders = useStore(state => state.orders);
  const validateOrder = useStore(state => state.validateOrder);
  const cancelOrder = useStore(state => state.cancelOrder);
  const removeItemFromPendingOrder = useStore(state => state.removeItemFromPendingOrder);
  const removeItemFromServedOrder = useStore(state => state.removeItemFromServedOrder);
  const updateServedItemPrice = useStore(state => state.updateServedItemPrice);
  const users = useStore(state => state.users);
  const tables = useStore(state => state.tables);
  const clients = useStore(state => state.clients);
  const removeClient = useStore(state => state.removeClient);
  const createClient = useStore(state => state.createClient);
  const products = useStore(state => state.products);
  const transferClient = useStore(state => state.transferClient);
  const assignClient = useStore(state => state.assignClient);
  const updateClientName = useStore(state => state.updateClientName);
  const freeTable = useStore(state => state.freeTable);
  const reopenClient = useStore(state => state.reopenClient);
  const settlePayment = useStore(state => state.settlePayment);
  const pastEvents = useStore(state => state.pastEvents);
  const addNotification = useStore(state => state.addNotification);
  
  const [activeView, setActiveView] = useState<'queue' | 'history' | 'stats' | 'map' | 'recap' | 'caisse' | 'factures'>('queue');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [tempPrices, setTempPrices] = useState<{ [itemId: string]: string }>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [waiterFilter, setWaiterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [freeTableForAction, setFreeTableForAction] = useState<Table | null>(null);

  const [itemToEditPrice, setItemToEditPrice] = useState<{orderId: string, itemId: string, currentPrice: number, productName: string} | null>(null);
  const [newPriceInput, setNewPriceInput] = useState('');
  const [priceChangeReason, setPriceChangeReason] = useState('');

  // 🆕 États pour les modals Pass Manager - Gestion Client Complète
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedClientForOrder, setSelectedClientForOrder] = useState<Client | null>(null);
  
  // États pour nouveau client avec table/serveur
  const [newClientName, setNewClientName] = useState('');
  const [newClientApporteur, setNewClientApporteur] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedWaiterId, setSelectedWaiterId] = useState('');
  
  // États pour transfert de table
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [clientToTransfer, setClientToTransfer] = useState<Client | null>(null);
  const [targetTableId, setTargetTableId] = useState('');
  
  // États pour changer de serveur
  const [showChangeWaiterModal, setShowChangeWaiterModal] = useState(false);
  const [clientToChangeWaiter, setClientToChangeWaiter] = useState<Client | null>(null);
  const [newWaiterId, setNewWaiterId] = useState('');
  
  // États pour modifier le nom
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [clientToEditName, setClientToEditName] = useState<Client | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const { exportToPDF: generatePDFReport, sharePDF: sharePDFReport, exportToExcel: generateExcelReport } = useExport();
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

  // Tables disponibles
  const availableTables = useMemo(() =>
    tables.filter(t => t.status === TableStatus.AVAILABLE),
    [tables]
  );
  
  // Serveurs actifs
  const activeWaiters = useMemo(() => 
    users.filter(u => u.role === UserRole.WAITER && u.isActive), 
    [users]
  );

  const waiters = useMemo(() => 
    users.filter(u => [UserRole.WAITER, UserRole.MANAGER, UserRole.ADMIN].includes(u.role)), 
    [users]
  );

  const COLORS = CHART_COLORS;

  const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  const filteredHistory = useMemo(() => {
    return orders
      .filter(o => o.status !== OrderStatus.PENDING)
      .filter(o => {
        const client = clients.find(c => c.id === o.clientId);
        const matchesSearch = client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
        const matchesWaiter = waiterFilter === '' || o.waiterId === waiterFilter;
        const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchesSearch && matchesWaiter && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, clients, searchQuery, waiterFilter, statusFilter]);

  const waiterStats = useMemo(() => {
    if (!users || !orders) return [];
    const revenueMap = new Map<string, number>();
    orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED).forEach(o => {
      const current = revenueMap.get(o.waiterId) || 0;
      revenueMap.set(o.waiterId, current + (Number(o.totalAmount) || 0));
    });
    return Array.from(revenueMap.entries())
      .map(([userId, revenue]) => {
        const user = users.find(u => u.id === userId);
        return {
          id: userId,
          name: user ? user.firstName : 'Inconnu',
          revenue: revenue
        };
      })
      .filter(stat => stat.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [users, orders]);

  const totalRevenue = useMemo(() => {
    return orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED).reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  // CA SAW : zone club uniquement
  const sawRevenue = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== OrderStatus.SERVED && o.status !== OrderStatus.SETTLED) return false;
      const client = clients.find(c => c.id === o.clientId);
      const table = tables.find(t => t.id === (o.tableId || client?.tableId));
      const zone = table ? getTableZone(table.number, table.zone) : 'club';
      return zone !== 'bar';
    }).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
  }, [orders, clients, tables]);


  // =====================================================
  // ✅ HANDLERS OPTIMISÉS AVEC useCallback
  // =====================================================

  // ✅ OPTIMISATION : useCallback pour generateReceipt
  const generateReceipt = useCallback(() => {
    const servedOrders = orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);

    // Agréger les items
    const itemMap: Record<string, { quantity: number, name: string, size: string, total: number }> = {};
    servedOrders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.productName}-${item.size}-${item.unitPrice}`;
        if (!itemMap[key]) {
          itemMap[key] = { quantity: 0, name: item.productName, size: item.size, total: 0 };
        }
        itemMap[key].quantity += item.quantity;
        itemMap[key].total += item.subtotal;
      });
    });
    const allItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);

    // Calculer la hauteur estimée du document
    let estimatedHeight = 90; // En-tête + CA
    estimatedHeight += waiterStats.length * 6;
    if (allItems.length > 0) estimatedHeight += 20 + allItems.length * 5;

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, Math.max(180, estimatedHeight)]
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DEFLOWER CLUB", centerX, 10, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("PASS MANAGER - Z DE CAISSE", centerX, 16, { align: "center" });
    doc.text(`Édité le : ${new Date().toLocaleString('fr-FR')}`, centerX, 20, { align: "center" });

    doc.setLineWidth(0.2);
    doc.line(5, 24, pageWidth - 5, 24);

    // === RÉCAPITULATIF CA ===
    let currentY = 32;
    doc.setLineWidth(0.3);
    doc.line(5, currentY, pageWidth - 5, currentY);
    currentY += 6;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CA TOTAL", 5, currentY);
    doc.setFontSize(14);
    doc.text(`${totalRevenue.toFixed(0)}€`, pageWidth - 5, currentY, { align: "right" });

    currentY += 10;
    doc.setLineWidth(0.1);
    doc.line(5, currentY, pageWidth - 5, currentY);

    // === PERFORMANCE ÉQUIPE ===
    currentY += 7;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PERFORMANCE ÉQUIPE", centerX, currentY, { align: "center" });
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    waiterStats.forEach((stat) => {
      doc.text(stat.name.toUpperCase(), 5, currentY);
      doc.setFont("helvetica", "bold");
      doc.text(`${stat.revenue.toFixed(0)}€`, pageWidth - 5, currentY, { align: "right" });
      doc.setFont("helvetica", "normal");
      currentY += 6;
    });

    // === DÉTAIL VENTES ===
    if (allItems.length > 0) {
      currentY += 5;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.3);
      doc.line(20, currentY, pageWidth - 20, currentY);
      currentY += 8;

      doc.setDrawColor(0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(153, 153, 153);
      doc.text("DÉTAIL VENTES", centerX, currentY, { align: "center" });
      doc.setTextColor(0, 0, 0);
      currentY += 6;

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text("QTE  ARTICLE", 5, currentY);
      doc.text("TOTAL", pageWidth - 5, currentY, { align: "right" });
      currentY += 4;

      doc.setTextColor(0);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      allItems.forEach(item => {
        const sizeLabel = item.size !== 'standard' ? `(${item.size})` : '';
        const quantityStr = `${item.quantity}x`.padEnd(4, ' ');
        const nameStr = `${item.name} ${sizeLabel}`.substring(0, 25);

        doc.text(quantityStr, 5, currentY);
        doc.text(nameStr, 15, currentY);
        doc.text(`${item.total.toFixed(0)}€`, pageWidth - 5, currentY, { align: "right" });
        currentY += 5;
      });
    }

    currentY += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.text("Document de contrôle - Deflower Club", centerX, currentY, { align: "center" });

    doc.save(`Z_Caisse_${new Date().getHours()}h${new Date().getMinutes()}.pdf`);
  }, [orders, waiterStats, totalRevenue]);

  // ✅ OPTIMISATION : useCallback pour handleValidation
  const handleValidation = useCallback((orderId: string) => {
    const corrections = Object.entries(tempPrices).map(([itemId, price]) => ({
      itemId, price: parseFloat(price as string)
    })).filter(c => !isNaN(c.price));
    validateOrder(orderId, corrections.length > 0 ? corrections : undefined);
    setEditingOrderId(null); 
    setTempPrices({});
  }, [tempPrices, validateOrder]);

  // ✅ OPTIMISATION : useCallback pour handleCancelSubmit
  const handleCancelSubmit = useCallback(async () => {
    if (orderToCancel && cancelReason.trim()) {
      try {
        await cancelOrder(orderToCancel.id, cancelReason.toUpperCase());
        setOrderToCancel(null);
        setCancelReason('');
      } catch {
        addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
      }
    }
  }, [orderToCancel, cancelReason, cancelOrder, addNotification]);

  // ✅ OPTIMISATION : useCallback pour handleDeleteClient
  const handleDeleteClient = useCallback((clientId: string) => {
    removeClient(clientId);
  }, [removeClient]);

  // ✅ OPTIMISATION : useCallback pour handleDeleteServedItem
  const handleDeleteServedItem = useCallback(async (orderId: string, itemId: string, productName: string) => {
    if (confirm(`Confirmez-vous le retrait de : ${productName} ?\n(Cela recalculera le CA de la soirée)`)) {
      try {
        await removeItemFromServedOrder(orderId, itemId);
      } catch {
        addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
      }
    }
  }, [removeItemFromServedOrder, addNotification]);

  // ✅ OPTIMISATION : useCallback pour handleTableClick
  // 🔧 FIX: Priorité aux clients actifs pour éviter qu'un ancien client encaissé masque le nouveau
  const handleTableClick = useCallback((table: Table) => {
    const clientOnTable = clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      (c.status === 'assigned' || c.status === 'pending')
    ) || clients.find(c =>
      (c.tableId === table.id || c.linkedTableIds?.includes(table.id)) &&
      c.status === 'closed'
    );
    if (clientOnTable) {
      setSelectedTable(table);
    } else if (table.status === TableStatus.AVAILABLE) {
      setFreeTableForAction(table);
    } else {
      setSelectedTable(table);
    }
  }, [clients]);

  // --- HANDLERS FREE TABLE MODAL ---
  const handleFreeTableCreateClient = useCallback((name: string, apporteur?: string, waiterId?: string) => {
    if (!freeTableForAction) return;
    createClient(name, apporteur || '', freeTableForAction.id, waiterId || '');
    const tableLabel = freeTableForAction.number.toUpperCase().startsWith('BAR')
      ? freeTableForAction.number
      : `Table ${freeTableForAction.number}`;
    addNotification({ type: 'success', title: 'CLIENT INSTALLÉ', message: `${name} → ${tableLabel}` });
  }, [freeTableForAction, createClient, addNotification]);

  const handleFreeTableAssignExisting = useCallback((clientId: string, waiterId?: string) => {
    if (!freeTableForAction) return;
    assignClient(clientId, freeTableForAction.id, waiterId || '');
    const client = clients.find(c => c.id === clientId);
    const tableLabel = freeTableForAction.number.toUpperCase().startsWith('BAR')
      ? freeTableForAction.number
      : `Table ${freeTableForAction.number}`;
    addNotification({ type: 'success', title: 'CLIENT INSTALLÉ', message: `${client?.name || ''} → ${tableLabel}` });
  }, [freeTableForAction, assignClient, clients, addNotification]);

  // Clients en attente (pas de table)
  const pendingClientsForTable = useMemo(() =>
    clients.filter(c => c.status === 'pending' && !c.tableId),
    [clients]
  );

  // ✅ OPTIMISATION : useCallback pour openEditPriceModal
  const openEditPriceModal = useCallback((orderId: string, item: any) => {
    setItemToEditPrice({
        orderId,
        itemId: item.id,
        currentPrice: item.unitPrice,
        productName: item.productName
    });
    setNewPriceInput(item.unitPrice.toString());
    setPriceChangeReason('');
  }, []);

  // ✅ OPTIMISATION : useCallback pour handlePriceUpdateSubmit
  const handlePriceUpdateSubmit = useCallback(async () => {
    if (itemToEditPrice && newPriceInput && priceChangeReason.trim()) {
        const price = parseFloat(newPriceInput);
        if (!isNaN(price)) {
          try {
            await updateServedItemPrice(itemToEditPrice.orderId, itemToEditPrice.itemId, price, priceChangeReason);
            setItemToEditPrice(null);
            setNewPriceInput('');
            setPriceChangeReason('');
          } catch {
            addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
          }
        }
    }
  }, [itemToEditPrice, newPriceInput, priceChangeReason, updateServedItemPrice, addNotification]);

  // ✅ OPTIMISATION : useCallback pour handleRemoveItemFromPending
  const handleRemoveItemFromPending = useCallback((orderId: string, itemId: string) => {
    removeItemFromPendingOrder(orderId, itemId);
  }, [removeItemFromPendingOrder]);

  // ✅ OPTIMISATION : useCallback pour handleSetTempPrice
  const handleSetTempPrice = useCallback((itemId: string, value: string) => {
    setTempPrices(prev => ({ ...prev, [itemId]: value }));
  }, []);

  // =====================================================
  // 🆕 HANDLERS GESTION CLIENT (Pass Manager)
  // =====================================================

  // Créer un nouveau client avec table + serveur optionnels
  const handleCreateNewClient = useCallback(() => {
    if (!newClientName) return;
    createClient(newClientName, newClientApporteur, selectedTableId || undefined, selectedWaiterId || undefined);
    setNewClientName('');
    setNewClientApporteur('');
    setSelectedTableId('');
    setSelectedWaiterId('');
    setShowNewClientModal(false);
  }, [newClientName, newClientApporteur, selectedTableId, selectedWaiterId, createClient]);

  // Ouvrir le modal de commande depuis la map
  const handleOpenOrderFromMap = useCallback((client: Client) => {
    setSelectedClientForOrder(client);
    setShowOrderModal(true);
  }, []);

  // Fermer le modal de commande
  const handleCloseOrderModal = useCallback(() => {
    setShowOrderModal(false);
    setSelectedClientForOrder(null);
  }, []);

  // Ouvrir le modal de transfert
  const openTransferModal = useCallback((client: Client) => {
    setClientToTransfer(client);
    setTargetTableId('');
    setShowTransferModal(true);
  }, []);

  // Soumettre le transfert de table
  const handleTransferSubmit = useCallback(async () => {
    if (clientToTransfer && targetTableId) {
      try {
        await transferClient(clientToTransfer.id, targetTableId);
        setClientToTransfer(null);
        setTargetTableId('');
        setShowTransferModal(false);
        setSelectedTable(null);
      } catch {
        addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
      }
    }
  }, [clientToTransfer, targetTableId, transferClient, addNotification]);

  // Ouvrir le modal de changement de serveur
  const openChangeWaiterModal = useCallback((client: Client) => {
    setClientToChangeWaiter(client);
    setNewWaiterId(client.waiterId || '');
    setShowChangeWaiterModal(true);
  }, []);

  // Soumettre le changement de serveur
  const handleChangeWaiterSubmit = useCallback(async () => {
    if (clientToChangeWaiter && clientToChangeWaiter.tableId) {
      try {
        await assignClient(clientToChangeWaiter.id, clientToChangeWaiter.tableId, newWaiterId);
        setClientToChangeWaiter(null);
        setNewWaiterId('');
        setShowChangeWaiterModal(false);
      } catch {
        addNotification({ type: 'error', title: 'ERREUR', message: 'Action échouée' });
      }
    }
  }, [clientToChangeWaiter, newWaiterId, assignClient, addNotification]);

  // Ouvrir le modal d'édition du nom
  const openEditNameModal = useCallback((client: Client) => {
    setClientToEditName(client);
    setEditNameValue(client.name);
    setShowEditNameModal(true);
  }, []);

  // Soumettre la modification du nom
  const handleEditNameSubmit = useCallback(async () => {
    if (clientToEditName && editNameValue.trim()) {
      await updateClientName(clientToEditName.id, editNameValue.trim());
      setClientToEditName(null);
      setEditNameValue('');
      setShowEditNameModal(false);
    }
  }, [clientToEditName, editNameValue, updateClientName]);

  return (
    <div className="space-y-6 fade-in-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-white tracking-tighter uppercase">Pass Manager</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="gold-line w-8"></div>
            <p className="text-zinc-400 text-xs font-semibold uppercase">Validation & Suivi</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
          {/* Bouton Nouvelle Résa - Premium */}
          <button
            onClick={() => setShowNewClientModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold uppercase bg-white text-black hover:bg-zinc-200"
          >
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Nouvelle</span> Résa
          </button>

          {/* Navigation Tabs - Premium Design */}
          <div className="bg-zinc-900 border border-zinc-800 flex p-1.5 sm:p-2 rounded-xl sm:rounded-xl overflow-x-auto no-scrollbar gap-1 sm:gap-1">
            <button onClick={() => setActiveView('queue')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'queue' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">File</span> ({pendingOrders.length})
            </button>
            <button onClick={() => setActiveView('history')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'history' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Historique</span><span className="sm:hidden">Hist.</span>
            </button>
            <button onClick={() => setActiveView('stats')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'stats' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Stats
            </button>
            <button onClick={() => setActiveView('map')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'map' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Plan
            </button>
            <button onClick={() => setActiveView('recap')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'recap' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Récap
            </button>
            <button onClick={() => setActiveView('caisse')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'caisse' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Caisse
            </button>
            <button onClick={() => setActiveView('factures')} className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap ${activeView === 'factures' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Factures
            </button>
            <button onClick={generateReceipt} className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-xs font-semibold uppercase transition-all whitespace-nowrap bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white">
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Ticket</span><span className="sm:hidden">Z</span>
            </button>
          </div>
        </div>
      </div>

      {activeView === 'queue' && (
        <div className="space-y-4">
          {pendingOrders.map((order, idx) => {
            const waiter = users.find(u => u.id === order.waiterId);
            const client = clients.find(c => c.id === order.clientId);
            const table = tables.find(t => t.id === order.tableId);
            const isEditing = editingOrderId === order.id;

            return (
              <div key={order.id} style={{ animationDelay: `${idx * 50}ms` }} className="bg-zinc-900 border border-zinc-800 p-5 md:p-6 rounded-xl border-zinc-800 fade-in-up relative group">
                {/* Menu contextuel pour actions dangereuses */}
                <div className="absolute top-5 right-5 md:top-6 md:right-6">
                  <details className="relative">
                    <summary className="list-none cursor-pointer p-2 rounded-xl hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </summary>
                    <div className="absolute right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl z-50 overflow-hidden min-w-[200px]">
                      <button 
                        onClick={() => {
                          if (confirm("⚠️ ATTENTION\n\nSupprimer ce client et TOUTES ses commandes ?\n\nCette action est irréversible.")) {
                            handleDeleteClient(order.clientId);
                          }
                        }} 
                        className="w-full px-4 py-3 text-left text-red-500 hover:bg-red-500/10 font-semibold text-sm flex items-center gap-3 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" /> Supprimer le client
                      </button>
                    </div>
                  </details>
                </div>
                <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
                  <div className="lg:w-56 shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="bg-white text-black px-3 py-1 rounded-lg text-lg font-semibold uppercase">{table?.number.toUpperCase().startsWith('BAR') ? table.number : `T${table?.number}`}</span>
                       <span className="text-xs text-zinc-600 font-semibold">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <h4 className="text-xl md:text-2xl font-semibold text-white uppercase tracking-tighter truncate">{client?.name}</h4>
                    <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Serveur: {waiter?.firstName}</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-b-0 gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="text-white font-semibold">{item.quantity}x</span>
                          <span className="text-zinc-300 ml-2 uppercase">{item.productName}</span>
                          <span className="text-zinc-500 text-xs ml-2">({item.size})</span>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-3">
                            <input type="number" defaultValue={item.unitPrice} onChange={(e) => handleSetTempPrice(item.id, e.target.value)} className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-right font-semibold text-sm outline-none" />
                            <span className="text-zinc-600">€</span>
                            <button onClick={() => handleRemoveItemFromPending(order.id, item.id)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all" title="Retirer cet article"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <span className="text-white font-semibold">{item.subtotal}€</span>
                        )}
                      </div>
                    ))}
                    {order.note && (
                      <div className="flex items-center gap-2 text-amber-400/80 text-xs mt-2 bg-amber-400/5 p-3 rounded-xl">
                        <StickyNote className="w-4 h-4 shrink-0" />
                        <span className="italic uppercase">{order.note}</span>
                      </div>
                    )}
                  </div>
                  <div className="lg:w-56 shrink-0 flex flex-col gap-3">
                    <div className="text-right mb-2">
                      <p className="text-xs text-zinc-600 font-semibold uppercase">Total</p>
                      <p className="text-3xl font-semibold text-white">{order.totalAmount}€</p>
                    </div>
                    {isEditing ? (
                      <button onClick={() => handleValidation(order.id)} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-semibold uppercase text-sm active:scale-95 transition-all flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Confirmer</button>
                    ) : (
                      <button onClick={() => handleValidation(order.id)} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-semibold uppercase text-sm active:scale-95 transition-all flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Valider</button>
                    )}
                    <button onClick={() => setEditingOrderId(isEditing ? null : order.id)} className={`w-full py-3 px-4 rounded-xl font-semibold uppercase text-xs transition-all flex items-center justify-center gap-2 ${isEditing ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white'}`}>
                      <Edit3 className="w-4 h-4" /> {isEditing ? 'Terminer édition' : 'Modifier prix/articles'}
                    </button>
                    <button onClick={() => { setOrderToCancel(order); setCancelReason(''); }} className="w-full py-4 px-4 rounded-xl bg-red-500/10 text-red-500 font-semibold uppercase text-sm hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 border-2 border-red-500/20">
                      <X className="w-5 h-5" /> Annuler la commande
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pendingOrders.length === 0 && (
            <div className="py-32 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-semibold uppercase text-sm">Aucune commande en attente</div>
          )}
        </div>
      )}

      {activeView === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
              <input type="text" placeholder="Rechercher un client..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-semibold outline-none focus:border-zinc-700" />
            </div>
            <select value={waiterFilter} onChange={(e) => setWaiterFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold outline-none focus:border-zinc-700 appearance-none cursor-pointer">
              <option value="">Tous les serveurs</option>
              {waiters.map(w => (<option key={w.id} value={w.id}>{w.firstName}</option>))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold outline-none focus:border-zinc-700 appearance-none cursor-pointer">
              <option value="all">Tous les statuts</option>
              <option value={OrderStatus.SERVED}>Servies</option>
              <option value={OrderStatus.SETTLED}>Encaissées</option>
              <option value={OrderStatus.CANCELLED}>Annulées</option>
            </select>
          </div>
          <div className="space-y-3">
            {filteredHistory.map(order => {
              const waiter = users.find(u => u.id === order.waiterId);
              const client = clients.find(c => c.id === order.clientId);
              const table = tables.find(t => t.id === order.tableId);
              const isServed = order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED;

              return (
                <div key={order.id} className={`bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-zinc-800 ${!isServed && 'opacity-50'}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase ${order.status === OrderStatus.SETTLED ? 'bg-blue-500/20 text-blue-400' : isServed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>{order.status === OrderStatus.SETTLED ? 'Encaissée' : isServed ? 'Servie' : 'Annulée'}</span>
                      <span className="text-zinc-600 text-xs">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className="text-xl font-semibold text-white">{order.totalAmount}€</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-zinc-400 font-semibold text-sm">{table?.number.toUpperCase().startsWith('BAR') ? table.number : `T${table?.number}`}</span>
                    <span className="text-white font-semibold uppercase truncate">{client?.name}</span>
                    <span className="text-zinc-600 text-xs">• {waiter?.firstName}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-zinc-800 rounded-xl gap-4">
                        <span className="text-zinc-400 text-sm flex-1">{item.quantity}x {item.productName} <span className="text-zinc-500">({item.size})</span></span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm min-w-[50px] text-right">{item.subtotal}€</span>
                          {isServed && (
                            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-zinc-800">
                              <button 
                                onClick={() => openEditPriceModal(order.id, item)} 
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all text-xs font-semibold"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Prix
                              </button>
                              <button 
                                onClick={() => handleDeleteServedItem(order.id, item.id, item.productName)} 
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Retirer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Articles retirés/annulés */}
                    {order.removedItems && order.removedItems.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-red-500/20">
                        <p className="text-red-400/60 text-xs font-semibold uppercase mb-2 flex items-center gap-2">
                          <Trash2 className="w-3 h-3" /> Articles retirés
                        </p>
                        {order.removedItems.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-2 px-3 bg-red-500/5 rounded-xl gap-4 mb-1">
                            <span className="text-red-400/60 text-sm flex-1 line-through">
                              {item.quantity}x {item.productName} <span className="text-red-400/30">({item.size})</span>
                            </span>
                            <span className="text-red-400/60 font-semibold text-sm line-through">{item.subtotal}€</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Bouton annuler commande complète (seulement pour commandes servies) */}
                  {isServed && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <button 
                        onClick={() => { setOrderToCancel(order); setCancelReason(''); }}
                        className="w-full py-3 px-4 rounded-xl bg-red-500/10 text-red-500 font-semibold uppercase text-xs hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 border border-red-500/20"
                      >
                        <X className="w-4 h-4" /> Annuler toute la commande
                      </button>
                    </div>
                  )}
                  
                  {order.cancelReason && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 text-xs font-semibold uppercase flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Commande annulee
                      </p>
                      <p className="text-red-300/80 text-xs">Motif : {order.cancelReason}</p>
                      {order.cancelledByName && (
                        <p className="text-red-400/50 text-xs mt-1">
                          Par {order.cancelledByName}{order.cancelledAt ? ` - ${new Date(order.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredHistory.length === 0 && (
              <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-semibold uppercase text-sm">Aucune commande dans l'historique</div>
            )}
          </div>
        </div>
      )}

      {activeView === 'stats' && (
        <div className="space-y-6">
          {/* KPI CA Total + CA SAW */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl border-zinc-800 text-center">
              <p className="text-2xl md:text-3xl font-semibold text-zinc-400">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">CA Total</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl border-zinc-800 text-center">
              <p className="text-2xl md:text-3xl font-semibold text-amber-400">{formatCurrency(sawRevenue)}</p>
              <p className="text-xs text-amber-400/60 font-semibold uppercase mt-1">CA SAW</p>
            </div>
          </div>
          {/* Stats commandes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-zinc-800 text-center">
              <CheckCircle className="w-7 h-7 mx-auto mb-2 text-zinc-400" />
              <p className="text-3xl font-semibold text-zinc-400">{orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED).length}</p>
              <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Commandes Servies</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl border-zinc-800 text-center">
              <AlertTriangle className="w-7 h-7 mx-auto mb-2 text-red-500" />
              <p className="text-3xl font-semibold text-red-500">{orders.filter(o => o.status === OrderStatus.CANCELLED).length}</p>
              <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Commandes Annulées</p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800">
            <h3 className="text-xl font-semibold text-white uppercase tracking-tighter mb-6">Performance Équipe</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {waiterStats.map((stat, index) => (
                <div key={stat.id} className="bg-zinc-800 p-4 rounded-xl text-center">
                  <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <p className="text-white font-semibold uppercase text-sm">{stat.name}</p>
                  <p className="text-lg font-semibold" style={{ color: COLORS[index % COLORS.length] }}>{stat.revenue.toFixed(0)}€</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'map' && (
        <div className="animate-in fade-in duration-300">
          {/* Layout en grille sur desktop uniquement */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
            {/* Carte - Pleine largeur sur mobile/tablette, 3/5 sur desktop */}
            <div className="lg:col-span-3">
              <TableMap tables={tables} clients={clients} onTableClick={handleTableClick} selectedTableId={selectedTable?.id} />
            </div>
            
            {/* Panneau latéral - UNIQUEMENT sur desktop (lg+) */}
            <div className="hidden lg:block lg:col-span-2">
              {selectedTable ? (
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800 sticky top-4 max-h-[85vh] overflow-y-auto no-scrollbar">
                  {/* Header Table */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white uppercase tracking-tighter">
                      Table {selectedTable.number}
                    </h3>
                  </div>
                  
                  {(() => {
                    // 🔧 FIX: Inclure aussi les clients encaissés (closed) pour pouvoir les gérer
                    const clientOnTable = clients.find(c => c.tableId === selectedTable.id);
                    if (!clientOnTable) {
                      return (
                        <div className="text-center py-8">
                          <MapPin className="w-12 h-12 mx-auto text-emerald-500/30 mb-3" />
                          <p className="text-zinc-500 font-semibold uppercase text-sm">Table disponible</p>
                          <p className="text-zinc-600 text-xs mt-1">Sélectionner pour attribuer un client</p>
                        </div>
                      );
                    }
                    
                    const clientOrders = orders.filter(o => o.clientId === clientOnTable.id);
                    const servedOrders = clientOrders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
                    const pendingOrders = clientOrders.filter(o => o.status === OrderStatus.PENDING);
                    const totalSpent = servedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
                    const pendingTotal = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
                    const waiter = users.find(u => u.id === clientOnTable.waiterId);
                    const isClosed = clientOnTable.status === 'closed';
                    
                    return (
                      <div className="space-y-4">
                        {/* Badge statut si encaissé */}
                        {isClosed && (
                          <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl px-3 py-2 text-center">
                            <span className="text-purple-400 font-semibold text-xs uppercase">✓ Client Encaissé</span>
                          </div>
                        )}
                        
                        {/* Infos client */}
                        <div className="space-y-2">
                          <p className={`font-semibold uppercase text-xl truncate ${isClosed ? 'text-purple-400' : 'text-zinc-400'}`}>{clientOnTable.name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-zinc-400">{clientOrders.length} cmd</span>
                            <span className="text-emerald-500 font-semibold">{isClosed ? clientOnTable.totalSpent : totalSpent}€ {isClosed ? 'encaissé' : 'servi'}</span>
                            {!isClosed && pendingTotal > 0 && <span className="text-blue-400 font-semibold animate-pulse">{pendingTotal}€ en attente</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {waiter && <span className="text-indigo-400/80 bg-indigo-500/10 px-2 py-1 rounded-lg">👤 {waiter.firstName}</span>}
                            {clientOnTable.businessProvider && <span className="text-amber-400/80 bg-amber-500/10 px-2 py-1 rounded-lg">💎 {clientOnTable.businessProvider}</span>}
                          </div>
                        </div>
                        
                        {/* 🆕 DÉTAIL DES COMMANDES */}
                        {clientOrders.length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-zinc-800">
                            <p className="text-zinc-500 text-xs font-semibold uppercase">Détail commandes</p>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                              {/* Commandes en attente */}
                              {pendingOrders.map(order => (
                                <div key={order.id} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-blue-400 text-xs font-semibold uppercase flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> En attente
                                    </span>
                                    <span className="text-white font-semibold text-sm">{order.totalAmount}€</span>
                                  </div>
                                  <div className="space-y-1">
                                    {order.items.map(item => (
                                      <p key={item.id} className="text-zinc-400 text-xs">
                                        <span className="text-white font-semibold">{item.quantity}x</span> {item.productName} <span className="text-blue-400/50">({item.size})</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {/* Commandes servies */}
                              {servedOrders.map(order => (
                                <div key={order.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-emerald-400 text-xs font-semibold uppercase flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> Servi
                                    </span>
                                    <span className="text-white font-semibold text-sm">{order.totalAmount}€</span>
                                  </div>
                                  <div className="space-y-1">
                                    {order.items.map(item => (
                                      <p key={item.id} className="text-zinc-400 text-xs">
                                        <span className="text-white font-semibold">{item.quantity}x</span> {item.productName} <span className="text-emerald-400/50">({item.size})</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 🆕 Actions selon le statut du client */}
                        {isClosed ? (
                          /* === CLIENT ENCAISSÉ === */
                          <div className="space-y-3 pt-3 border-t border-zinc-800">
                            <button 
                              onClick={() => {
                                if (confirm(`Réouvrir le client ${clientOnTable.name} ?\nIl pourra à nouveau passer des commandes.`)) {
                                  reopenClient(clientOnTable.id);
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-amber-500 text-black hover:bg-amber-400 active:scale-[0.98] transition-all"
                            >
                              <RotateCw className="w-5 h-5" /> Réouvrir Client
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm(`Libérer la table ${selectedTable.number} ?\nLe client ${clientOnTable.name} sera retiré.`)) {
                                  freeTable(selectedTable.id);
                                  setSelectedTable(null);
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-purple-600 text-white hover:bg-purple-500 active:scale-[0.98] transition-all"
                            >
                              <LogOut className="w-5 h-5" /> Libérer Table
                            </button>
                          </div>
                        ) : (
                          /* === CLIENT ACTIF === */
                          <>
                            {/* Bouton Commander */}
                            <button 
                              onClick={() => handleOpenOrderFromMap(clientOnTable)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.98] transition-all"
                            >
                              <ShoppingCart className="w-5 h-5" /> Commander
                            </button>
                            
                            {/* Bouton Encaisser */}
                            <button 
                              onClick={() => {
                                if (confirm(`💰 Encaisser ${clientOnTable.name} ?\n\nTotal: ${servedOrders.reduce((acc, o) => acc + o.totalAmount, 0)}€\n\nLe client sera marqué comme encaissé.`)) {
                                  settlePayment(clientOnTable.id);
                                }
                              }}
                              disabled={servedOrders.length === 0}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Wallet className="w-5 h-5" /> Encaisser
                            </button>
                            
                            {/* Actions - Grid 2x2 */}
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
                              <button 
                                onClick={() => openEditNameModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold uppercase text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all active:scale-95"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Nom
                              </button>
                              <button 
                                onClick={() => openTransferModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold uppercase text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all active:scale-95"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" /> Table
                              </button>
                              <button 
                                onClick={() => openChangeWaiterModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold uppercase text-xs bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all active:scale-95"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Serveur
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm(`⚠️ Supprimer le client ${clientOnTable.name} et toutes ses commandes ?`)) {
                                    removeClient(clientOnTable.id);
                                    setSelectedTable(null);
                                  }
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold uppercase text-xs bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Suppr.
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Message quand aucune table sélectionnée */
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800 flex items-center justify-center min-h-[300px]">
                  <div className="text-center">
                    <MapPin className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
                    <p className="text-zinc-600 font-semibold uppercase text-sm">Sélectionner une table</p>
                    <p className="text-zinc-600 text-xs mt-1">Cliquez sur une table pour voir les détails</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 📱 POPUP MOBILE/TABLETTE - Affiché uniquement sur écrans < lg */}
          {selectedTable && (
            <div className="lg:hidden fixed inset-0 z-[400] flex items-end justify-center bg-black/60" onClick={() => setSelectedTable(null)}>
              <div 
                className="w-full max-w-lg bg-zinc-950 rounded-t-[2rem] border-t border-zinc-800 animate-in slide-in-from-bottom duration-300"
                onClick={e => e.stopPropagation()}
              >
                {/* Handle de drag visuel */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-12 h-1 bg-zinc-800 rounded-full" />
                </div>
                
                <div className="px-5 pb-6 pt-2 max-h-[70vh] overflow-y-auto no-scrollbar">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white uppercase tracking-tighter">
                      Table {selectedTable.number}
                    </h3>
                    <button 
                      onClick={() => setSelectedTable(null)}
                      className="p-2 rounded-xl bg-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {(() => {
                    // 🔧 FIX: Inclure aussi les clients encaissés (closed)
                    const clientOnTable = clients.find(c => c.tableId === selectedTable.id);
                    if (!clientOnTable) {
                      return (
                        <div className="text-center py-6">
                          <MapPin className="w-10 h-10 mx-auto text-emerald-500/30 mb-2" />
                          <p className="text-zinc-500 font-semibold uppercase text-sm">Table disponible</p>
                        </div>
                      );
                    }
                    
                    const clientOrders = orders.filter(o => o.clientId === clientOnTable.id);
                    const servedOrders = clientOrders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED);
                    const pendingOrders = clientOrders.filter(o => o.status === OrderStatus.PENDING);
                    const totalSpent = servedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
                    const pendingTotal = pendingOrders.reduce((acc, o) => acc + o.totalAmount, 0);
                    const waiter = users.find(u => u.id === clientOnTable.waiterId);
                    const isClosed = clientOnTable.status === 'closed';
                    
                    return (
                      <div className="space-y-4">
                        {/* Badge statut si encaissé */}
                        {isClosed && (
                          <div className="bg-purple-500/20 border border-purple-500/30 rounded-xl px-3 py-2 text-center">
                            <span className="text-purple-400 font-semibold text-xs uppercase">✓ Client Encaissé</span>
                          </div>
                        )}
                        
                        {/* Infos client - Compact */}
                        <div className="space-y-2">
                          <p className={`font-semibold uppercase text-lg ${isClosed ? 'text-purple-400' : 'text-zinc-400'}`}>{clientOnTable.name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-zinc-400">{clientOrders.length} cmd</span>
                            <span className="text-emerald-500 font-semibold">{isClosed ? clientOnTable.totalSpent : totalSpent}€ {isClosed ? 'encaissé' : 'servi'}</span>
                            {!isClosed && pendingTotal > 0 && <span className="text-blue-400 font-semibold animate-pulse">{pendingTotal}€ en attente</span>}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {waiter && <span className="text-indigo-400/80 bg-indigo-500/10 px-2 py-1 rounded-lg">👤 {waiter.firstName}</span>}
                            {clientOnTable.businessProvider && <span className="text-amber-400/80 bg-amber-500/10 px-2 py-1 rounded-lg">💎 {clientOnTable.businessProvider}</span>}
                          </div>
                        </div>
                        
                        {/* 🆕 DÉTAIL DES COMMANDES */}
                        {clientOrders.length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-zinc-800">
                            <p className="text-zinc-500 text-xs font-semibold uppercase">Détail commandes</p>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                              {/* Commandes en attente */}
                              {pendingOrders.map(order => (
                                <div key={order.id} className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-blue-400 text-xs font-semibold uppercase flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" /> En attente
                                    </span>
                                    <span className="text-white font-semibold text-xs">{order.totalAmount}€</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {order.items.map(item => (
                                      <p key={item.id} className="text-zinc-400 text-[11px]">
                                        <span className="text-white font-semibold">{item.quantity}x</span> {item.productName}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {/* Commandes servies */}
                              {servedOrders.map(order => (
                                <div key={order.id} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-emerald-400 text-xs font-semibold uppercase flex items-center gap-1">
                                      <CheckCircle className="w-2.5 h-2.5" /> Servi
                                    </span>
                                    <span className="text-white font-semibold text-xs">{order.totalAmount}€</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {order.items.map(item => (
                                      <p key={item.id} className="text-zinc-400 text-[11px]">
                                        <span className="text-white font-semibold">{item.quantity}x</span> {item.productName}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 🆕 Actions selon le statut du client */}
                        {isClosed ? (
                          /* === CLIENT ENCAISSÉ === */
                          <div className="space-y-3 pt-3 border-t border-zinc-800">
                            <button 
                              onClick={() => {
                                if (confirm(`Réouvrir le client ${clientOnTable.name} ?\nIl pourra à nouveau passer des commandes.`)) {
                                  reopenClient(clientOnTable.id);
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-amber-500 text-black active:scale-[0.98] transition-all"
                            >
                              <RotateCw className="w-5 h-5" /> Réouvrir Client
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm(`Libérer la table ${selectedTable.number} ?\nLe client ${clientOnTable.name} sera retiré.`)) {
                                  freeTable(selectedTable.id);
                                  setSelectedTable(null);
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-purple-600 text-white active:scale-[0.98] transition-all"
                            >
                              <LogOut className="w-5 h-5" /> Libérer Table
                            </button>
                          </div>
                        ) : (
                          /* === CLIENT ACTIF === */
                          <>
                            {/* Bouton Commander - Grand et visible */}
                            <button 
                              onClick={() => handleOpenOrderFromMap(clientOnTable)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white active:scale-[0.98] transition-all"
                            >
                              <ShoppingCart className="w-5 h-5" /> Commander
                            </button>
                            
                            {/* Bouton Encaisser */}
                            <button 
                              onClick={() => {
                                if (confirm(`💰 Encaisser ${clientOnTable.name} ?\n\nTotal: ${servedOrders.reduce((acc, o) => acc + o.totalAmount, 0)}€\n\nLe client sera marqué comme encaissé.`)) {
                                  settlePayment(clientOnTable.id);
                                }
                              }}
                              disabled={servedOrders.length === 0}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-semibold uppercase text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Wallet className="w-5 h-5" /> Encaisser
                            </button>
                            
                            {/* Actions - Grid 2x2 */}
                            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800">
                              <button 
                                onClick={() => openEditNameModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-semibold uppercase text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 active:bg-amber-500 active:text-white transition-all"
                              >
                                <Edit3 className="w-4 h-4" /> Nom
                              </button>
                              <button 
                                onClick={() => openTransferModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-semibold uppercase text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 active:bg-blue-500 active:text-white transition-all"
                              >
                                <ArrowRightLeft className="w-4 h-4" /> Table
                              </button>
                              <button 
                                onClick={() => openChangeWaiterModal(clientOnTable)}
                                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-semibold uppercase text-xs bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 active:bg-indigo-500 active:text-white transition-all"
                              >
                                <UserCheck className="w-4 h-4" /> Serveur
                              </button>
                              <button 
                                onClick={() => {
                                  if (confirm(`⚠️ Supprimer le client ${clientOnTable.name} et toutes ses commandes ?`)) {
                                    removeClient(clientOnTable.id);
                                    setSelectedTable(null);
                                  }
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-semibold uppercase text-xs bg-red-500/10 text-red-500 border border-red-500/20 active:bg-red-500 active:text-white transition-all"
                              >
                                <Trash2 className="w-4 h-4" /> Suppr.
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL CANCEL ORDER --- */}
      {orderToCancel && (() => {
        const cancelClient = clients.find(c => c.id === orderToCancel.clientId);
        const cancelTable = tables.find(t => t.id === orderToCancel.tableId);
        const isServedOrder = orderToCancel.status === OrderStatus.SERVED || orderToCancel.status === OrderStatus.SETTLED;
        
        return (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-zinc-900 p-8 rounded-xl w-full max-w-md border border-zinc-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-semibold text-white uppercase tracking-tighter">Annuler Commande</h3>
                <button onClick={() => setOrderToCancel(null)} className="bg-zinc-800 p-3 rounded-full text-zinc-600"><X /></button>
              </div>
              
              {/* Avertissement si commande déjà servie */}
              {isServedOrder && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-500 font-semibold text-sm uppercase">Attention - Commande déjà servie</p>
                      <p className="text-red-400/70 text-xs mt-1">Cette annulation va recalculer le CA de la soirée et impacter les statistiques.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Infos commande */}
              <div className="mb-4 p-4 bg-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-semibold">{cancelTable?.number.toUpperCase().startsWith('BAR') ? cancelTable.number : `T${cancelTable?.number}`}</span>
                    <span className="text-white font-semibold uppercase">{cancelClient?.name}</span>
                  </div>
                  <span className="text-white font-semibold text-xl">{orderToCancel.totalAmount}€</span>
                </div>
                <div className="space-y-1 mt-3">
                  {orderToCancel.items.map(item => (
                    <p key={item.id} className="text-zinc-500 text-xs">
                      {item.quantity}x {item.productName} ({item.size}) — {item.subtotal}€
                    </p>
                  ))}
                </div>
              </div>
              
              <textarea 
                placeholder="MOTIF D'ANNULATION (obligatoire)" 
                value={cancelReason} 
                onChange={(e) => setCancelReason(e.target.value.toUpperCase())} 
                className="w-full bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-white font-semibold outline-none uppercase resize-none h-32 placeholder:text-zinc-600 focus:border-red-500/50" 
              />
              <button 
                onClick={handleCancelSubmit} 
                disabled={!cancelReason.trim()} 
                className="w-full mt-6 bg-red-600 disabled:opacity-30 py-5 rounded-xl font-semibold text-lg text-white uppercase active:scale-95 transition-all"
              >
                Confirmer Annulation
              </button>
            </div>
          </div>
        );
      })()}

      {/* --- MODAL EDIT PRICE --- */}
      {itemToEditPrice && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 p-8 rounded-xl w-full max-w-md border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white uppercase tracking-tighter">Modifier Prix</h3>
              <button onClick={() => setItemToEditPrice(null)} className="bg-zinc-800 p-3 rounded-full text-zinc-600"><X /></button>
            </div>
            <p className="text-zinc-400 mb-4">{itemToEditPrice.productName} - Prix actuel: <span className="text-white font-semibold">{itemToEditPrice.currentPrice}€</span></p>
            <div className="space-y-4">
              <div className="relative">
                <input type="number" placeholder="Nouveau prix" value={newPriceInput} onChange={(e) => setNewPriceInput(e.target.value)} className="w-full bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-white font-semibold text-2xl outline-none focus:border-amber-500/50" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xl">€</span>
              </div>
              <textarea placeholder="MOTIF DE MODIFICATION (obligatoire)" value={priceChangeReason} onChange={(e) => setPriceChangeReason(e.target.value.toUpperCase())} className="w-full bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-white font-semibold outline-none uppercase resize-none h-24 placeholder:text-zinc-600 focus:border-amber-500/50" />
            </div>
            <button onClick={handlePriceUpdateSubmit} disabled={!newPriceInput || !priceChangeReason.trim()} className="w-full mt-6 bg-amber-600 disabled:opacity-30 py-5 rounded-xl font-semibold text-lg text-white uppercase active:scale-95 transition-all">Modifier Prix</button>
          </div>
        </div>
      )}

      {/* Récap Tab */}
      {activeView === 'recap' && (
        <div className="space-y-6 fade-in-up">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white uppercase">Récap des Soirées</h3>
            <div className="gold-line flex-1 opacity-20"></div>
          </div>
          {/* Filtre par mois */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => navigateMonth(-1)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-800 transition-colors">
              <ChevronLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <span className="text-white font-semibold uppercase tracking-wide min-w-[200px] text-center capitalize">{filterMonthLabel}</span>
            <button onClick={() => navigateMonth(1)} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-800 transition-colors">
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {filteredPastEvents.length === 0 ? (<p className="text-center text-zinc-600 py-20 font-semibold uppercase">Aucune soirée ce mois.</p>) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPastEvents.map((event, idx) => (
                <div key={event.id} style={{ animationDelay: `${idx * 50}ms` }} className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-zinc-800 hover:border-zinc-700 transition-all relative group fade-in-up">
                  <div className="cursor-pointer">
                    <p className="text-lg font-semibold text-white uppercase">{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <div className="flex items-center justify-between"><span className="text-xs font-semibold text-zinc-500 uppercase">CA Total</span><span className="text-2xl font-semibold text-zinc-400">{formatCurrency(event.totalRevenue)}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                    <button onClick={() => generatePDFReport(event)} className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-xl font-semibold uppercase text-xs hover:bg-red-600/30 transition-all"><Download className="w-3 h-3" /> PDF</button>
                    <button onClick={() => sharePDFReport(event)} className="flex-1 flex items-center justify-center gap-2 bg-sky-600/20 text-sky-400 px-4 py-2 rounded-xl font-semibold uppercase text-xs hover:bg-sky-600/30 transition-all"><Share2 className="w-3 h-3" /> Partager</button>
                    <button onClick={() => generateExcelReport(event)} title="Excel" aria-label="Exporter Excel" className="flex items-center justify-center bg-emerald-600/20 text-emerald-400 px-3 py-2 rounded-xl hover:bg-emerald-600/30 transition-all"><FileSpreadsheet className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeView === 'caisse' && (
        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" /></div>}>
          <CaisseTab />
        </Suspense>
      )}

      {activeView === 'factures' && (
        <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" /></div>}>
          <InvoicesManager />
        </Suspense>
      )}

      {/* =====================================================
          MODALS GESTION CLIENT (Pass Manager)
          ===================================================== */}

      {/* --- MODAL NOUVELLE RÉSA --- */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 p-10 rounded-t-[3rem] sm:rounded-xl w-full max-w-md border-t border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">Nouvelle Résa</h3>
              <button onClick={() => setShowNewClientModal(false)} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>
            <div className="space-y-4">
              <input 
                placeholder="NOM DU CLIENT" 
                value={newClientName} 
                onChange={e => setNewClientName(e.target.value.toUpperCase())} 
                className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold text-xl uppercase outline-none focus:border-white" 
                autoFocus 
              />
              <input 
                placeholder="APPORTEUR (OPTIONNEL)" 
                value={newClientApporteur} 
                onChange={e => setNewClientApporteur(e.target.value.toUpperCase())} 
                className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold text-lg uppercase outline-none focus:border-white" 
              />
              <select 
                value={selectedTableId} 
                onChange={e => setSelectedTableId(e.target.value)} 
                className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold uppercase outline-none focus:border-white appearance-none cursor-pointer"
              >
                <option value="">-- Table (optionnel) --</option>
                {availableTables.map(t => (<option key={t.id} value={t.id}>Table {t.number}</option>))}
              </select>
              <select 
                value={selectedWaiterId} 
                onChange={e => setSelectedWaiterId(e.target.value)} 
                className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold uppercase outline-none focus:border-white appearance-none cursor-pointer"
              >
                <option value="">-- Serveur (optionnel) --</option>
                {activeWaiters.map(w => (<option key={w.id} value={w.id}>{w.firstName} {w.lastName}</option>))}
              </select>
            </div>
            <button 
              onClick={handleCreateNewClient} 
              disabled={!newClientName} 
              className="w-full mt-8 bg-emerald-600 disabled:opacity-30 py-6 rounded-xl font-semibold text-xl text-white uppercase active:scale-95"
            >
              Créer Réservation
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL TRANSFERT DE TABLE --- */}
      {showTransferModal && clientToTransfer && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 p-10 rounded-t-[3rem] sm:rounded-xl w-full max-w-md h-[85vh] flex flex-col border-t border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">Changer Table</h3>
                <p className="text-xs font-semibold text-zinc-400 uppercase truncate">{clientToTransfer.name}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-8 pr-1 no-scrollbar">
              {availableTables.length === 0 ? (
                <p className="text-center text-zinc-600 py-10">Aucune table disponible</p>
              ) : (
                availableTables.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setTargetTableId(t.id)} 
                    className={`w-full py-7 px-8 rounded-xl font-semibold text-3xl flex justify-between items-center border-4 transition-all ${targetTableId === t.id ? 'bg-white border-zinc-800 text-black' : 'bg-zinc-800 border-transparent text-zinc-600'}`}
                  >
                    <span>T{t.number}</span>
                    <span className="text-sm opacity-50">{t.capacity} places</span>
                  </button>
                ))
              )}
            </div>
            <div className="pt-8 border-t border-zinc-800">
              <button 
                onClick={handleTransferSubmit} 
                disabled={!targetTableId} 
                className="w-full bg-blue-600 disabled:opacity-30 py-8 rounded-xl font-semibold text-3xl text-white uppercase active:scale-95 transition-all"
              >
                Transférer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CHANGER DE SERVEUR --- */}
      {showChangeWaiterModal && clientToChangeWaiter && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-900 p-10 rounded-t-[3rem] sm:rounded-xl w-full max-w-md border-t border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">Changer Serveur</h3>
                <p className="text-xs font-semibold text-zinc-400 uppercase truncate">{clientToChangeWaiter.name}</p>
              </div>
              <button onClick={() => setShowChangeWaiterModal(false)} className="bg-zinc-800 p-4 rounded-full text-zinc-600"><X /></button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar">
              {activeWaiters.map(w => (
                <button 
                  key={w.id} 
                  onClick={() => setNewWaiterId(w.id)} 
                  className={`w-full py-5 px-6 rounded-xl font-semibold text-xl flex items-center gap-4 border-4 transition-all ${newWaiterId === w.id ? 'bg-indigo-600 border-indigo-400/30 text-white' : 'bg-zinc-800 border-transparent text-zinc-500'}`}
                >
                  <UserIcon className="w-6 h-6" />
                  <span>{w.firstName} {w.lastName}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={handleChangeWaiterSubmit} 
              disabled={!newWaiterId} 
              className="w-full mt-8 bg-indigo-600 disabled:opacity-30 py-6 rounded-xl font-semibold text-xl text-white uppercase active:scale-95"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL MODIFIER NOM CLIENT --- */}
      {showEditNameModal && clientToEditName && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-900 p-8 rounded-xl w-full max-w-md border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-white uppercase tracking-tighter">Modifier Nom</h3>
              <button onClick={() => setShowEditNameModal(false)} className="bg-zinc-800 p-3 rounded-full text-zinc-600"><X /></button>
            </div>
            <input 
              type="text" 
              value={editNameValue} 
              onChange={(e) => setEditNameValue(e.target.value.toUpperCase())} 
              className="w-full bg-zinc-800 border-2 border-zinc-800 py-5 px-6 rounded-xl text-white font-semibold text-xl uppercase outline-none focus:border-white" 
              autoFocus 
            />
            <button 
              onClick={handleEditNameSubmit} 
              disabled={!editNameValue.trim()} 
              className="w-full mt-6 bg-amber-600 disabled:opacity-30 py-5 rounded-xl font-semibold text-lg text-white uppercase active:scale-95 transition-all"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* 🆕 MODAL COMMANDE (Pass Manager) */}
      <OrderModal
        isOpen={showOrderModal}
        client={selectedClientForOrder}
        products={products}
        onClose={handleCloseOrderModal}
        onSuccess={() => setSelectedTable(null)}
      />

      {/* MODAL TABLE LIBRE */}
      <FreeTableModal
        isOpen={!!freeTableForAction}
        onClose={() => setFreeTableForAction(null)}
        table={freeTableForAction}
        pendingClients={pendingClientsForTable}
        onAssignExisting={handleFreeTableAssignExisting}
        onCreateClient={handleFreeTableCreateClient}
        waiters={activeWaiters}
      />
    </div>
  );
};

export default ManagerDashboard;