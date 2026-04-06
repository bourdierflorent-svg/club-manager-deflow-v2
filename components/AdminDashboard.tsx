import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStore } from '../store/index';
import { UserRole, User, EveningEvent, TableStatus, OrderStatus, Client, Table, ArchiveTableEntry } from '../src/types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from 'recharts';
import {
  BarChart3, Users, Settings, ClipboardList,
  Play, StopCircle, UserPlus, ShieldAlert, Download, LayoutGrid, X, History,
  User as UserIcon, AlertTriangle, Shield, Trash2, RefreshCcw, Mail, Lock, UserCog,
  Zap, Handshake, MapPin, FileSpreadsheet, Trophy, Briefcase, Edit3, RotateCcw,
  LogOut, Plus, UserMinus, Link, RotateCw, Calendar, Pencil, XCircle,
  ChevronLeft, ChevronRight, Wallet, FileText, Wine
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, aggregateEventData, CHART_COLORS, generateShortId, getTableZone } from '../src/utils';
import { useExport } from '../src/hooks/useExport';

import { FreeTableModal, EditRecapModal } from './modals';

// ✅ LAZY LOADING - Ces composants chargent à la demande
const TableMap = lazy(() => import('./TableMap'));
const AdminOrderModal = lazy(() => import('./AdminOrderModal'));
const ReservationsManager = lazy(() => import('./ReservationsManager'));
const CaisseTab = lazy(() => import('./CaisseTab'));
const HubClientsPage = lazy(() => import('./HubClientsPage'));
const InvoicesManager = lazy(() => import('./InvoicesManager'));

// ✅ Écran de chargement simple
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
  </div>
);

const AdminDashboard: React.FC = () => {
  const {
    currentEvent, startEvening, closeEvening, users, addUser, updateUser, deleteUser,
    orders, clients, tables, auditLogs, pastEvents, resetAllData, addNotification,
    createClient, transferClient, handoverClient, settlePayment, freeTable, assignClient,
    currentUser, removeClient, updateClientName, deleteEvent, updateArchivedApporteur,
    addTable, unassignClient, linkTableToClient, unlinkTableFromClient,
    reopenClient, cancelOrder, removeItemFromServedOrder, updateServedItemPrice,
    updateArchivedRecapEntry, deleteArchivedRecapEntry, recoverEvent
  } = useStore();
  
  // --- ÉTATS ---
  const [activeTab, setActiveTab] = useState<'overview' | 'service' | 'team' | 'logs' | 'evenings' | 'config' | 'reservations' | 'caisse' | 'clients' | 'recapbouteilles'>('overview');
  const [isEditMapMode, setIsEditMapMode] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState('');
  
  // --- MODALS ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false); 
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [freeTableForAction, setFreeTableForAction] = useState<Table | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showLinkTableModal, setShowLinkTableModal] = useState(false);

  // --- SELECTIONS & DATA ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedArchive, setSelectedArchive] = useState<EveningEvent | null>(null);
  const [editingApporteur, setEditingApporteur] = useState<{name: string, value: string} | null>(null);
  const [editingRecapEntry, setEditingRecapEntry] = useState<{ entry: ArchiveTableEntry; index: number } | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [archiveToDelete, setArchiveToDelete] = useState<EveningEvent | null>(null);
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  
  // --- FORMULAIRES ---
  const [editClientNameValue, setEditClientNameValue] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientApporteur, setNewClientApporteur] = useState('');
  const [selectedWaiterId, setSelectedWaiterId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [targetTableId, setTargetTableId] = useState('');
  const [targetWaiterId, setTargetWaiterId] = useState('');

  // --- GESTION COMMANDES ADMIN ---
  const [adminCancellingOrderId, setAdminCancellingOrderId] = useState<string | null>(null);
  const [adminCancelReason, setAdminCancelReason] = useState('');
  const [adminEditingPrice, setAdminEditingPrice] = useState<{
    orderId: string; itemId: string; currentPrice: number; productName: string;
  } | null>(null);
  const [adminNewPriceValue, setAdminNewPriceValue] = useState('');
  const [adminEditReason, setAdminEditReason] = useState('');
  const [adminRemovingItem, setAdminRemovingItem] = useState<{
    orderId: string; itemId: string; itemName: string;
  } | null>(null);
  const [adminRemoveReason, setAdminRemoveReason] = useState('');

  const [userFormData, setUserFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: UserRole.WAITER,
    pin: '',
  });

  const [startData, setStartData] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    name: '' 
  });

  const COLORS = CHART_COLORS;
  const { exportToPDF, exportToExcel } = useExport();

  const availableTables = tables.filter(t => t.status === TableStatus.AVAILABLE);
  const activeWaiters = users.filter(u => u.role === UserRole.WAITER && u.isActive);
  const activeClients = clients.filter(c => c.status !== 'closed');
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

  // NEW Verification si l'utilisateur est gerant (Admin)
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // --- CALCULS STATS ---
  const archiveWaiterStats = useMemo(() => {
    if (!selectedArchive || !selectedArchive.detailedHistory) return [];
    const stats: { [key: string]: number } = {};
    selectedArchive.detailedHistory.forEach((entry: any) => {
      const wName = entry.waiterName || 'Non Specifie'; 
      stats[wName] = (stats[wName] || 0) + entry.totalAmount;
    });
    return Object.entries(stats).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [selectedArchive]);

  const waiterStats = useMemo(() => {
    if (!users || !orders) return [];
    return users.filter(u => u.role === UserRole.WAITER).map(u => ({
        name: u.firstName,
        revenue: orders.filter(o => o.waiterId === u.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)).reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0)
      })).sort((a, b) => b.revenue - a.revenue);
  }, [users, orders]);

  const promoterStats = useMemo(() => {
    const stats = new Map<string, { revenue: number, tables: number }>();
    clients.forEach(client => {
      const apporteur = client.businessProvider ? client.businessProvider.toUpperCase() : null;
      if (apporteur) {
        let clientRevenue = 0;
        if (client.status === 'closed') {
           clientRevenue = client.totalSpent;
        } else {
           clientRevenue = orders.filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)).reduce((acc, o) => acc + o.totalAmount, 0);
        }
        if (clientRevenue > 0) {
            const current = stats.get(apporteur) || { revenue: 0, tables: 0 };
            stats.set(apporteur, { revenue: current.revenue + clientRevenue, tables: current.tables + 1 });
        }
      }
    });
    return Array.from(stats.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.revenue - a.revenue);
  }, [clients, orders]);

  // CA total + par zone
  const totalRevenue = useMemo(() => {
    return orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)
      .reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  const { clubRevenue, barRevenue } = useMemo(() => {
    let club = 0, bar = 0;
    orders.filter(o => o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED).forEach(o => {
      const client = clients.find(c => c.id === o.clientId);
      const table = tables.find(t => t.id === (o.tableId || client?.tableId));
      const zone = table ? getTableZone(table.number, table.zone) : 'club';
      if (zone === 'bar') bar += o.totalAmount;
      else club += o.totalAmount;
    });
    return { clubRevenue: club, barRevenue: bar };
  }, [orders, clients, tables]);

  // =====================================================
  // OK HANDLERS OPTIMISES AVEC useCallback
  // =====================================================

  const handleDeleteArchive = useCallback((e: React.MouseEvent, event: EveningEvent) => {
    e.stopPropagation();
    setArchiveToDelete(event);
  }, []);

  const handleConfirmDeleteArchive = async () => {
    if (!archiveToDelete) return;
    const name = archiveToDelete.name || 'Soiree';
    const id = archiveToDelete.id;
    // Fermer le modal AVANT l'action async
    setArchiveToDelete(null);
    setSelectedArchive(null);
    await deleteEvent(id);
    addNotification({ type: 'success', title: 'ARCHIVE SUPPRIMEE', message: `La soiree "${name}" a ete supprimee.` });
  };

  // --- RECAP BOUTEILLES (dernier récap archivé) ---
  const lastEventBottles = useMemo(() => {
    const lastEvent = sortedPastEvents[0];
    if (!lastEvent?.detailedHistory) return { items: [], date: '', name: '' };

    const itemMap: Record<string, { name: string; size: string; quantity: number }> = {};
    lastEvent.detailedHistory.forEach((entry: any) => {
      if (entry.structuredItems) {
        entry.structuredItems.forEach((si: any) => {
          const key = `${si.productName}-${si.size}`;
          if (!itemMap[key]) {
            itemMap[key] = { name: si.productName, size: si.size, quantity: 0 };
          }
          itemMap[key].quantity += si.quantity;
        });
      }
    });
    return {
      items: Object.values(itemMap).sort((a, b) => b.quantity - a.quantity),
      date: lastEvent.date,
      name: lastEvent.name || 'Derniere soiree',
    };
  }, [sortedPastEvents]);

  const exportBottlesPDF = useCallback(() => {
    if (lastEventBottles.items.length === 0) return;
    const doc = new jsPDF();
    const totalBottles = lastEventBottles.items.reduce((acc, i) => acc + i.quantity, 0);

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DEFLOWER - Recap Bouteilles', 14, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`${lastEventBottles.name} - ${new Date(lastEventBottles.date).toLocaleDateString('fr-FR')}`, 14, 30);
    doc.text(`Total: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, 38);

    autoTable(doc, {
      head: [['Bouteille', 'Taille', 'Quantite']],
      body: lastEventBottles.items.map(item => [item.name, item.size, `${item.quantity}`]),
      startY: 46,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const },
      alternateRowStyles: { fillColor: [245, 245, 245] as [number, number, number] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${totalBottles} bouteille${totalBottles > 1 ? 's' : ''}`, 14, finalY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 14, doc.internal.pageSize.height - 10);
    doc.save(`Recap_Bouteilles_${lastEventBottles.date}.pdf`);
  }, [lastEventBottles]);

  // --- HANDLERS GESTION COMMANDES ADMIN ---
  const handleAdminCancelOrder = useCallback(async () => {
    if (!adminCancellingOrderId || !adminCancelReason.trim()) return;
    await cancelOrder(adminCancellingOrderId, adminCancelReason.trim());
    setAdminCancellingOrderId(null);
    setAdminCancelReason('');
  }, [adminCancellingOrderId, adminCancelReason, cancelOrder]);

  const handleAdminPriceEdit = useCallback(async () => {
    if (!adminEditingPrice || !adminEditReason.trim() || !adminNewPriceValue) return;
    const price = parseFloat(adminNewPriceValue);
    if (isNaN(price) || price < 0) return;
    await updateServedItemPrice(adminEditingPrice.orderId, adminEditingPrice.itemId, price, adminEditReason.trim());
    setAdminEditingPrice(null);
    setAdminNewPriceValue('');
    setAdminEditReason('');
  }, [adminEditingPrice, adminNewPriceValue, adminEditReason, updateServedItemPrice]);

  const handleAdminRemoveItem = useCallback(async () => {
    if (!adminRemovingItem || !adminRemoveReason.trim()) return;
    await removeItemFromServedOrder(adminRemovingItem.orderId, adminRemovingItem.itemId);
    setAdminRemovingItem(null);
    setAdminRemoveReason('');
  }, [adminRemovingItem, adminRemoveReason, removeItemFromServedOrder]);

  const openClientDetail = useCallback((client: Client) => { 
    setSelectedClientForDetail(client); 
    setShowDetailModal(true); 
  }, []);

  // 🔧 FIX: Priorité aux clients actifs pour éviter qu'un ancien client encaissé masque le nouveau
  const handleTableClick = useCallback((table: Table) => {
    if (isEditMapMode) return;
    const clientOnTable = clients.find(c =>
        (c.tableId === table.id || (c.linkedTableIds && c.linkedTableIds.includes(table.id))) &&
        c.status !== 'closed'
    ) || clients.find(c =>
        (c.tableId === table.id || (c.linkedTableIds && c.linkedTableIds.includes(table.id))) &&
        c.status === 'closed'
    );
    if (clientOnTable) {
      openClientDetail(clientOnTable);
    } else if (table.status === TableStatus.AVAILABLE) {
      setFreeTableForAction(table);
    }
  }, [isEditMapMode, clients, openClientDetail]);

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

  const handleCreateClient = useCallback(() => {
    if (!newClientName || !currentUser) return;
    createClient(newClientName, newClientApporteur, selectedTableId || undefined, selectedWaiterId || undefined);
    setNewClientName(''); 
    setNewClientApporteur(''); 
    setSelectedTableId(''); 
    setSelectedWaiterId(''); 
    setShowNewClientModal(false);
    addNotification({ type: 'success', title: 'CLIENT CREE', message: `Client ${newClientName} ajoute.` });
  }, [newClientName, newClientApporteur, selectedTableId, selectedWaiterId, currentUser, createClient, addNotification]);

  const handleTransferClient = useCallback(() => {
    if (selectedClientForDetail && targetTableId) {
      transferClient(selectedClientForDetail.id, targetTableId);
      setTargetTableId(''); 
      setShowTransferModal(false); 
      setShowDetailModal(false);
      addNotification({ type: 'success', title: 'TRANSFERT', message: 'Client transfere.' });
    }
  }, [selectedClientForDetail, targetTableId, transferClient, addNotification]);

  // 🔧 FIX: Utiliser assignClient si le client n'a pas de serveur initial
  const handleHandoverClient = useCallback(() => {
    if (selectedClientForDetail && targetWaiterId) {
      // Si le client n'a pas de serveur assigné, on utilise assignClient
      // Sinon on utilise handoverClient pour la passation
      if (!selectedClientForDetail.waiterId) {
        // Client sans serveur → assignClient avec la table actuelle
        if (selectedClientForDetail.tableId) {
          assignClient(selectedClientForDetail.id, selectedClientForDetail.tableId, targetWaiterId);
        }
      } else {
        // Client avec serveur → handover normal
        handoverClient(selectedClientForDetail.id, targetWaiterId);
      }
      setTargetWaiterId(''); 
      setShowHandoverModal(false); 
      setShowDetailModal(false);
      addNotification({ type: 'success', title: 'CLIENT TRANSFERE', message: 'Serveur modifie.' });
    }
  }, [selectedClientForDetail, targetWaiterId, handoverClient, assignClient, addNotification]);
  
  const handleLinkTableSubmit = useCallback(() => {
    if (selectedClientForDetail && targetTableId) {
        linkTableToClient(selectedClientForDetail.id, targetTableId);
        setTargetTableId(''); 
        setShowLinkTableModal(false); 
        setShowDetailModal(false);
        addNotification({ type: 'success', title: 'TABLE LIEE', message: 'Table ajoutee au client.' });
    }
  }, [selectedClientForDetail, targetTableId, linkTableToClient, addNotification]);

  const handleStartEvening = useCallback(() => { 
    if (!startData.date) return; 
    startEvening(startData.date, startData.name || 'Soiree Deflower'); 
    setShowStartModal(false); 
  }, [startData, startEvening]);
  
  const handleConfirmClose = useCallback(() => { 
    closeEvening(); 
    setShowCloseConfirm(false); 
  }, [closeEvening]);

  const handleSaveUser = useCallback(() => {
    if (!userFormData.firstName || !userFormData.lastName || userFormData.pin.length !== 4) {
      addNotification({ type: 'error', title: 'ERREUR', message: 'Remplir tous les champs (PIN 4 chiffres).' }); 
      return;
    }
    const userData = { ...userFormData, isActive: true };
    if (editingUser) { 
      updateUser({ ...editingUser, ...userData }); 
    } else { 
      addUser({ ...userData } as User);
    }
    setShowUserModal(false); 
    setEditingUser(null); 
    setUserFormData({ firstName: '', lastName: '', email: '', role: UserRole.WAITER, pin: '' });
  }, [userFormData, editingUser, addNotification, updateUser, addUser]);

  const openEditUser = useCallback((user: User) => {
    setEditingUser(user);
    setUserFormData({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, pin: user.pin });
    setShowUserModal(true);
  }, []);

  const handleConfirmDeleteUser = useCallback(async () => {
    if (userToDelete) {
        await deleteUser(userToDelete.id);
        setUserToDelete(null);
        addNotification({ type: 'success', title: 'SUPPRESSION', message: 'Utilisateur supprime.' });
    }
  }, [userToDelete, deleteUser, addNotification]);

  const handleDeleteClient = useCallback((e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    if (confirm(`Supprimer le client ${client.name} et liberer la table ?`)) {
      removeClient(client.id);
      addNotification({ type: 'info', title: 'SUPPRESSION', message: `Client ${client.name} supprime.` });
    }
  }, [removeClient, addNotification]);

  const openEditClientName = useCallback((e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setClientToEdit(client);
    setEditClientNameValue(client.name);
  }, []);

  const handleUpdateClientName = useCallback(async () => {
    if (clientToEdit && editClientNameValue.trim()) {
        await updateClientName(clientToEdit.id, editClientNameValue.trim());
        setClientToEdit(null);
        setEditClientNameValue('');
        addNotification({ type: 'success', title: 'MODIFICATION', message: 'Nom du client mis Ã  jour.' });
    }
  }, [clientToEdit, editClientNameValue, updateClientName, addNotification]);

  const handleFreeTable = useCallback(() => {
    if (selectedClientForDetail && selectedClientForDetail.tableId) {
        if(confirm("Confirmer la liberation de la table ?")) {
            freeTable(selectedClientForDetail.tableId);
            setShowDetailModal(false);
            setSelectedClientForDetail(null);
            addNotification({ type: 'success', title: 'TABLE LIBEREE', message: 'Table disponible.' });
        }
    }
  }, [selectedClientForDetail, freeTable, addNotification]);
  
  const handleUnassignClient = useCallback(() => {
    if (selectedClientForDetail) {
      if(confirm(`Sortir ${selectedClientForDetail.name} de la table ? (Il retournera dans "Libres")`)) {
        unassignClient(selectedClientForDetail.id);
        setShowDetailModal(false);
        addNotification({ type: 'success', title: 'CLIENT SORTI', message: 'Client retire de la table.' });
      }
    }
  }, [selectedClientForDetail, unassignClient, addNotification]);

  const handleSettlePayment = useCallback(() => {
    if (selectedClientForDetail) {
      settlePayment(selectedClientForDetail.id);
      setShowDetailModal(false);
      addNotification({ type: 'success', title: 'ENCAISSEMENT', message: 'Client encaisse.' });
    }
  }, [selectedClientForDetail, settlePayment, addNotification]);

  // =====================================================
  // NEW NOUVEAU HANDLER : REOUVRIR UN CLIENT
  // =====================================================
  const handleReopenClient = useCallback(async () => {
    if (selectedClientForDetail) {
      if (confirm(`Reouvrir le client ${selectedClientForDetail.name} ? Il pourra Ã  nouveau commander.`)) {
        await reopenClient(selectedClientForDetail.id);
        setShowDetailModal(false);
        setSelectedClientForDetail(null);
      }
    }
  }, [selectedClientForDetail, reopenClient]);

  const renderTableIcon = useCallback((tableNumber: string) => {
    const isBar = tableNumber.toUpperCase().startsWith('BAR');
    if (isBar) {
        return (
            <div className="flex flex-col items-center justify-center leading-none">
                <span className="text-xs md:text-xs opacity-80 mb-0.5">BAR</span>
                <span className="text-xl md:text-3xl font-semibold">{tableNumber.replace(/BAR/i, '').trim()}</span>
            </div>
        );
    }
    return <span className="text-2xl md:text-4xl">T{tableNumber}</span>;
  }, []);

  const generateExcelReport = useCallback((event: EveningEvent) => {
    exportToExcel(event);
    addNotification({ type: 'success', title: 'EXPORT EXCEL', message: 'Le fichier Excel a ete genere.' });
  }, [exportToExcel, addNotification]);

  const generatePDFReport = useCallback((event: EveningEvent) => {
    exportToPDF(event);
  }, [exportToPDF]);

  const handleSaveApporteur = useCallback(async () => {
    if (editingApporteur && selectedArchive) {
      await updateArchivedApporteur(selectedArchive.id, editingApporteur.name, editingApporteur.value);
      setEditingApporteur(null);
    }
  }, [editingApporteur, selectedArchive, updateArchivedApporteur]);

  const handleSaveRecapEntry = useCallback(async (entryIndex: number, updatedEntry: ArchiveTableEntry) => {
    if (selectedArchive) {
      await updateArchivedRecapEntry(selectedArchive.id, entryIndex, updatedEntry);
      const updated = useStore.getState().pastEvents.find(e => e.id === selectedArchive.id);
      if (updated) setSelectedArchive(updated);
      setEditingRecapEntry(null);
      addNotification({ type: 'success', title: 'RECAP MODIFIE', message: 'Le recap a ete mis a jour.' });
    }
  }, [selectedArchive, updateArchivedRecapEntry, addNotification]);

  const handleDeleteRecapEntry = useCallback(async (entryIndex: number) => {
    if (selectedArchive) {
      await deleteArchivedRecapEntry(selectedArchive.id, entryIndex);
      const updated = useStore.getState().pastEvents.find(e => e.id === selectedArchive.id);
      if (updated) setSelectedArchive(updated);
      setEditingRecapEntry(null);
      addNotification({ type: 'success', title: 'COMMANDE SUPPRIMEE', message: 'La commande a ete supprimee du recap.' });
    }
  }, [selectedArchive, deleteArchivedRecapEntry, addNotification]);

  const openNewUserModal = useCallback(() => {
    setEditingUser(null);
    setUserFormData({ firstName: '', lastName: '', email: '', role: UserRole.WAITER, pin: '' });
    setShowUserModal(true);
  }, []);

  // Calcul du total client
  const getClientTotal = useCallback((client: Client) => {
    if (client.status === 'closed') return client.totalSpent;
    return orders.filter(o => o.clientId === client.id && (o.status === OrderStatus.SERVED || o.status === OrderStatus.SETTLED)).reduce((acc, o) => acc + o.totalAmount, 0);
  }, [orders]);

  return (
    <div className="space-y-8 pb-20">
      {/* Header - Premium Design */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 fade-in-up">
        <div>
          <h2 className="text-3xl font-semibold text-white tracking-tighter uppercase">Administration</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="gold-line w-12"></div>
            <p className="text-zinc-400 text-xs font-semibold uppercase">Console de controle Premium</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => window.location.reload()} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white transition-all active:scale-95 hover:border-zinc-700" title="Rafraichir"><RotateCcw className="w-5 h-5" /></button>
          {currentEvent ? (
            <button onClick={() => setShowCloseConfirm(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-medium uppercase text-xs"><StopCircle className="w-5 h-5" /> Cloturer la soiree</button>
          ) : (
            <button onClick={() => setShowStartModal(true)} className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-8 py-4 rounded-xl font-medium uppercase text-xs"><Play className="w-5 h-5" /> Demarrer la soiree</button>
          )}
        </div>
      </div>

      {/* Tabs - Premium Design */}
      <div className="flex border-b border-zinc-800 overflow-x-auto no-scrollbar gap-1 bg-zinc-900 rounded-t-xl p-2">
        {[ { id: 'overview', icon: BarChart3, label: 'Stats' }, { id: 'reservations', icon: Calendar, label: 'Résa' }, { id: 'config', icon: LayoutGrid, label: 'Plan' }, { id: 'evenings', icon: History, label: 'Récap' }, { id: 'caisse', icon: Wallet, label: 'Caisse' }, { id: 'clients', icon: Users, label: 'Clients' }, { id: 'service', icon: Zap, label: 'Live' }, { id: 'team', icon: Users, label: 'Equipe' }, { id: 'logs', icon: ClipboardList, label: 'Logs' }, { id: 'factures', icon: FileText, label: 'Factures' }, { id: 'recapbouteilles', icon: Wine, label: 'Recap Bouteilles' } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-3 flex items-center gap-2 font-semibold text-xs transition-all rounded-xl ${activeTab === tab.id ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300 border-transparent'}`}><tab.icon className="w-4 h-4" /> {tab.label}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* KPI CA Total - Premium Design */}
          <div className="stat-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center border-gradient hover-lift">
            <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">CA Total</p>
            <p className="stat-value text-3xl md:text-4xl font-semibold text-zinc-400 tracking-tighter">{formatCurrency(totalRevenue)}</p>
          </div>
          {/* CA Club + CA Bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
              <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">CA Club</p>
              <p className="text-3xl font-semibold text-white tracking-tighter">{formatCurrency(clubRevenue)}</p>
            </div>
            <div className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
              <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">CA Bar</p>
              <p className="text-3xl font-semibold text-white tracking-tighter">{formatCurrency(barRevenue)}</p>
            </div>
          </div>
          {/* Stats secondaires */}
          <div className="grid grid-cols-2 gap-4">
             <div className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
               <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Clients Actifs</p>
               <p className="text-4xl font-semibold text-white tracking-tighter">{clients.length}</p>
             </div>
             <div className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl text-center">
               <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Occupation Tables</p>
               <p className="text-4xl font-semibold text-white tracking-tighter">{tables.length > 0 ? Math.round((tables.filter(t => t.status !== TableStatus.AVAILABLE).length / tables.length) * 100) : 0}%</p>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl min-h-[450px]"><h3 className="text-lg font-semibold text-white uppercase mb-8">Performance Chefs de rang</h3><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={waiterStats}><XAxis dataKey="name" stroke="#64748b" fontSize={10} fontWeight="bold" /><Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} /><Bar dataKey="revenue" radius={[10, 10, 0, 0]}>{waiterStats.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div>
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl min-h-[450px]"><div className="flex items-center justify-between mb-8"><h3 className="text-lg font-semibold text-white uppercase flex items-center gap-2"><Briefcase className="w-5 h-5 text-zinc-400" /> Top Apporteurs</h3><span className="text-xs text-zinc-500 font-semibold">Soiree en cours</span></div><div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-2">{promoterStats.length === 0 ? (<p className="text-center text-zinc-600 py-10 font-medium uppercase">Aucun apporteur renseigne</p>) : (promoterStats.map((stat, idx) => (<div key={idx} className="flex items-center justify-between bg-zinc-800 p-4 rounded-xl border border-zinc-800"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-semibold text-xs">{idx + 1}</div><div><p className="font-semibold text-white uppercase">{stat.name}</p><p className="text-xs text-zinc-500 font-bold uppercase">{stat.tables} tables actives/fermees</p></div></div><span className="text-xl font-semibold text-zinc-400">{formatCurrency(stat.revenue)}</span></div>)))}</div></div>
          </div>
        </div>
      )}

      {/* Service Tab */}
      {activeTab === 'service' && (
        <div className="space-y-6 fade-in-up">
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-gradient">
            <div>
              <h3 className="text-lg font-semibold text-white uppercase">Clients en Salle</h3>
              <p className="text-zinc-400 text-xs font-bold">{activeClients.length} actifs</p>
            </div>
            <button onClick={() => setShowNewClientModal(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium uppercase text-xs"><UserPlus className="w-4 h-4" /> Creer Client</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client, idx) => {
              const table = tables.find(t => t.id === client.tableId);
              const waiter = users.find(u => u.id === client.waiterId);
              const isClosed = client.status === 'closed';
              return (
                <div key={client.id} onClick={() => openClientDetail(client)} style={{ animationDelay: `${idx * 50}ms` }} className={`premium-card bg-zinc-900 border border-zinc-800 rounded-xl p-5 cursor-pointer transition-all relative overflow-hidden fade-in-up ${isClosed ? 'opacity-40 border-zinc-800 bg-black/20' : 'hover:border-zinc-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className={`text-xl font-semibold uppercase tracking-tighter ${isClosed ? 'text-zinc-500' : 'text-white'}`}>{client.name}</h4>
                      {client.createdByName && <span className="text-xs font-semibold text-zinc-400 uppercase bg-zinc-800 px-2 py-0.5 rounded italic">By {client.createdByName.split(' ')[0]}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => openEditClientName(e, client)} className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10"><Edit3 className="w-3 h-3" /></button>
                      {client.tableId && !isClosed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if(confirm(`Dissocier ${client.name} de sa table ?`)) { unassignClient(client.id); addNotification({ type: 'info', title: 'DISSOCIÉ', message: `${client.name} retiré de la table.` }); } }}
                          className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-purple-400 hover:bg-purple-400/10"
                          title="Dissocier de la table"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={(e) => handleDeleteClient(e, client)} className="p-2 rounded-lg bg-zinc-800 text-zinc-500 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {client.businessProvider && <span className="text-xs font-semibold bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full truncate border border-zinc-700 max-w-[150px]">P: {client.businessProvider}</span>}
                    {isClosed ? (<span className="text-xs font-semibold bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full flex items-center gap-2 border border-emerald-500/20"><History className="w-3 h-3" /> ENCAISSE</span>) : table ? (<span className="text-xs font-semibold bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full flex items-center gap-2 border border-zinc-700"><MapPin className="w-3 h-3" /> TABLE {table.number}</span>) : (<span className="text-xs font-semibold bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full flex items-center gap-2 border border-amber-500/20">EN ATTENTE</span>)}
                    {waiter && <span className="text-xs font-semibold bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full flex items-center gap-2 border border-indigo-500/20"><UserIcon className="w-3 h-3" /> {waiter.firstName}</span>}
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-500">Total</span>
                    <span className={`text-2xl font-semibold ${isClosed ? 'text-emerald-500' : 'text-white'}`}>{getClientTotal(client).toFixed(0)}EUR</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Config Tab (Plan) */}
      {activeTab === 'config' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center bg-zinc-800 p-6 rounded-xl border border-zinc-800">
            <h3 className="text-lg font-semibold text-white uppercase">Plan de Salle</h3>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <TableMap tables={tables} clients={clients} onTableClick={handleTableClick} isEditMode={false} />
          </Suspense>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-6 fade-in-up">
          <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-6 rounded-xl border-gradient">
            <div>
              <h3 className="text-lg font-semibold text-white uppercase">Equipe</h3>
              <p className="text-zinc-500 text-xs font-bold">{users.length} membres</p>
            </div>
            <button onClick={openNewUserModal} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium uppercase text-xs"><UserPlus className="w-4 h-4" /> Nouvel Utilisateur</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user, idx) => (
              <div key={user.id} style={{ animationDelay: `${idx * 50}ms` }} className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between fade-in-up">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 font-semibold">{user.firstName[0]}{user.lastName[0]}</div>
                  <div><p className="font-semibold text-white uppercase">{user.firstName} {user.lastName}</p><p className="text-xs font-bold text-zinc-500 flex items-center gap-1">{user.role === UserRole.ADMIN ? <Shield className="w-3 h-3 text-zinc-400" /> : user.role === UserRole.MANAGER ? <UserCog className="w-3 h-3 text-emerald-500" /> : <UserIcon className="w-3 h-3" />} {user.role}</p></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEditUser(user)} className="p-3 rounded-xl bg-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => setUserToDelete(user)} className="p-3 rounded-xl bg-zinc-800 text-zinc-500 hover:text-red-500 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evenings Tab (Archives) */}
      {activeTab === 'evenings' && (
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

          {filteredPastEvents.length === 0 ? (<p className="text-center text-zinc-600 py-20 font-semibold">Aucune soirée ce mois.</p>) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPastEvents.map((event, idx) => (
                <div key={event.id} style={{ animationDelay: `${idx * 50}ms` }} className="premium-card bg-zinc-900 border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition-all relative group fade-in-up">
                  <button onClick={(e) => handleDeleteArchive(e, event)} className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-red-500/10 text-red-500/50 hover:text-red-500 hover:bg-red-500/20 md:opacity-0 md:group-hover:opacity-100 transition-all" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  <div onClick={() => setSelectedArchive(event)} className="cursor-pointer">
                    <p className="text-lg font-semibold text-white uppercase">{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <div className="flex items-center justify-between"><span className="text-xs font-bold text-zinc-500 uppercase">CA Total</span><span className="text-2xl font-semibold text-zinc-400">{formatCurrency(event.totalRevenue)}</span></div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-zinc-800">
                    <button onClick={(e) => { e.stopPropagation(); generatePDFReport(event); }} className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-xl font-semibold uppercase text-xs hover:bg-red-600/30 transition-all"><Download className="w-3 h-3" /> PDF</button>
                    <button onClick={(e) => { e.stopPropagation(); generateExcelReport(event); }} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-xl font-semibold uppercase text-xs hover:bg-emerald-600/30 transition-all"><FileSpreadsheet className="w-3 h-3" /> Excel</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <h3 className="text-lg font-semibold text-white uppercase">Journal d'Audit</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            {auditLogs.length === 0 ? (<p className="text-center text-zinc-600 py-20 font-semibold">Aucun log disponible.</p>) : (
              <table className="w-full text-left">
                <thead className="bg-zinc-800 sticky top-0"><tr><th className="p-4 text-xs font-semibold text-zinc-500">Heure</th><th className="p-4 text-xs font-semibold text-zinc-500">Utilisateur</th><th className="p-4 text-xs font-semibold text-zinc-500">Action</th><th className="p-4 text-xs font-semibold text-zinc-500">Details</th></tr></thead>
                <tbody className="divide-y divide-zinc-800">
                  {[...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (<tr key={log.id} className="hover:bg-zinc-800"><td className="p-4 text-xs text-zinc-400">{new Date(log.timestamp).toLocaleTimeString()}</td><td className="p-4 text-xs font-bold text-white">{log.userName}</td><td className="p-4 text-xs text-zinc-400 uppercase font-semibold">{log.action}</td><td className="p-4 text-xs text-zinc-500 max-w-xs truncate">{log.details}</td></tr>))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Reservations Tab */}
      {activeTab === 'reservations' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Suspense fallback={<LoadingSpinner />}>
            <ReservationsManager canForceDelete />
          </Suspense>
        </div>
      )}

      {/* Caisse Tab */}
      {activeTab === 'caisse' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Suspense fallback={<LoadingSpinner />}>
            <CaisseTab />
          </Suspense>
        </div>
      )}

      {/* Clients Hub Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Suspense fallback={<LoadingSpinner />}>
            <HubClientsPage />
          </Suspense>
        </div>
      )}

      {activeTab === 'factures' && (
        <Suspense fallback={<LoadingSpinner />}>
          <InvoicesManager />
        </Suspense>
      )}

      {/* Recap Bouteilles Tab */}
      {activeTab === 'recapbouteilles' && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {lastEventBottles.items.length === 0 ? (
            <div className="py-24 text-center bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-600 font-semibold uppercase text-sm">
              Aucune donnee disponible
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white uppercase">Recap Bouteilles</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{lastEventBottles.name} — {new Date(lastEventBottles.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                    {lastEventBottles.items.reduce((acc, i) => acc + i.quantity, 0)} bouteilles
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
                {lastEventBottles.items.map((item, idx) => (
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

      {/* =====================================================
          MODALS
      ===================================================== */}

      {/* MODAL USER */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-enter">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md modal-enter border-gradient">
            <h3 className="text-2xl font-semibold text-white uppercase mb-8">{editingUser ? 'Modifier' : 'Nouvel'} Utilisateur</h3>
            <div className="space-y-4">
              <input type="text" placeholder="PRENOM" value={userFormData.firstName} onChange={e => setUserFormData({...userFormData, firstName: e.target.value.toUpperCase()})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold uppercase outline-none focus:border-white" />
              <input type="text" placeholder="NOM" value={userFormData.lastName} onChange={e => setUserFormData({...userFormData, lastName: e.target.value.toUpperCase()})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold uppercase outline-none focus:border-white" />
              <input type="email" placeholder="Email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white outline-none focus:border-white" />
              <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as UserRole})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold uppercase outline-none focus:border-white">
                {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="text" placeholder="PIN (4 chiffres)" value={userFormData.pin} onChange={e => setUserFormData({...userFormData, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold text-center text-3xl tracking-[1em] outline-none focus:border-white" />
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleSaveUser} className="flex-1 bg-white text-black py-4 rounded-xl font-medium uppercase">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL START EVENING */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-enter">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md modal-enter border-gradient">
            <h3 className="text-2xl font-semibold text-white uppercase mb-8">Demarrer la Soiree</h3>
            <div className="space-y-4">
              <input type="date" value={startData.date} onChange={e => setStartData({...startData, date: e.target.value})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold outline-none focus:border-white" />
              <input type="text" placeholder="NOM DE LA SOIREE (optionnel)" value={startData.name} onChange={e => setStartData({...startData, name: e.target.value.toUpperCase()})} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold uppercase outline-none focus:border-white" />
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowStartModal(false)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleStartEvening} className="flex-1 bg-white text-black py-4 rounded-xl font-medium uppercase">Demarrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CLOSE CONFIRM */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-enter">
          <div className="bg-zinc-950 border border-red-500/20 rounded-xl p-10 w-full max-w-md text-center modal-enter">
            <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-500" />
            <h3 className="text-2xl font-semibold text-white uppercase mb-4">Cloturer la Soiree ?</h3>
            <p className="text-zinc-400 mb-8">Cette action archivera toutes les donnees. Assurez-vous que tous les clients ont ete encaisses.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowCloseConfirm(false)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleConfirmClose} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-medium uppercase">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOUVELLE RÉSA */}
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

      {/* MODAL DELETE USER CONFIRM */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md text-center">
            <Trash2 className="w-16 h-16 mx-auto mb-6 text-red-500" />
            <h3 className="text-2xl font-semibold text-white uppercase mb-4">Supprimer {userToDelete.firstName} ?</h3>
            <p className="text-zinc-400 mb-8">Cette action est irreversible.</p>
            <div className="flex gap-4">
              <button onClick={() => setUserToDelete(null)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleConfirmDeleteUser} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-medium uppercase">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DELETE ARCHIVE CONFIRM */}
      {archiveToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-amber-500" />
            <h3 className="text-2xl font-semibold text-white uppercase mb-2">Supprimer cette Archive ?</h3>
            <p className="text-zinc-400 font-semibold uppercase text-sm mb-4">"{archiveToDelete.name || 'Soiree'}"</p>
            <p className="text-xs text-zinc-500 mb-2">{new Date(archiveToDelete.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-lg font-semibold text-zinc-400 mb-6">CA : {formatCurrency(archiveToDelete.totalRevenue)}</p>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
              <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium uppercase text-xs">Attention</span>
              </div>
              <p className="text-red-400/80 text-xs">Cette action est <span className="font-semibold">DEFINITIVE</span>. Toutes les donnees de cette soiree (clients, commandes, statistiques) seront perdues.</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setArchiveToDelete(null)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleConfirmDeleteArchive} className="flex-1 bg-red-600 text-white py-4 rounded-xl font-semibold uppercase flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT CLIENT NAME */}
      {clientToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-10 w-full max-w-md">
            <h3 className="text-2xl font-semibold text-white uppercase mb-8">Modifier le Nom</h3>
            <input type="text" value={editClientNameValue} onChange={e => setEditClientNameValue(e.target.value.toUpperCase())} className="w-full bg-zinc-800 border-2 border-zinc-800 rounded-xl py-4 px-6 text-white font-semibold uppercase outline-none focus:border-white" autoFocus />
            <div className="flex gap-4 mt-8">
              <button onClick={() => setClientToEdit(null)} className="flex-1 bg-zinc-800 text-white py-4 rounded-xl font-medium uppercase">Annuler</button>
              <button onClick={handleUpdateClientName} className="flex-1 bg-white text-black py-4 rounded-xl font-medium uppercase">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARCHIVE DETAIL */}
      {selectedArchive && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-enter" onClick={() => setSelectedArchive(null)}>
          <div className="bg-zinc-950 border border-zinc-700 rounded-t-2xl sm:rounded-xl p-4 sm:p-6 md:p-10 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden modal-enter" onClick={(e) => e.stopPropagation()}>

            {/* Header with close X */}
            <div className="flex justify-between items-start mb-4 sm:mb-8 shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-2xl font-semibold text-white uppercase truncate">{selectedArchive.name || 'Soiree'}</h3>
                <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase">{new Date(selectedArchive.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setSelectedArchive(null)} className="text-zinc-500 hover:text-white p-2 hover:bg-zinc-800 rounded-xl transition-all shrink-0 -mt-1 -mr-1">
                <X className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-8 pr-1 sm:pr-2">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">CA Total</p><p className="text-lg sm:text-2xl font-semibold text-zinc-400">{formatCurrency(selectedArchive.totalRevenue)}</p></div>
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">Clients</p><p className="text-lg sm:text-2xl font-semibold text-white">{selectedArchive.clientCount || '-'}</p></div>
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">CA Club</p><p className="text-lg sm:text-2xl font-semibold text-purple-400">{formatCurrency(selectedArchive.clubRevenue || (selectedArchive.detailedHistory || []).filter((e: any) => (e.zone || 'club') !== 'bar').reduce((s: number, e: any) => s + e.totalAmount, 0))}</p></div>
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">CA Bar</p><p className="text-lg sm:text-2xl font-semibold text-blue-400">{formatCurrency(selectedArchive.barRevenue || (selectedArchive.detailedHistory || []).filter((e: any) => e.zone === 'bar').reduce((s: number, e: any) => s + e.totalAmount, 0))}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">Commandes</p><p className="text-lg sm:text-2xl font-semibold text-white">{selectedArchive.orderCount || '-'}</p></div>
                <div className="bg-zinc-800 p-3 sm:p-4 rounded-xl text-center"><p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase mb-1">Serveurs</p><p className="text-lg sm:text-2xl font-semibold text-white">{archiveWaiterStats.length}</p></div>
              </div>

              {/* Export buttons */}
              <div className="flex gap-2 sm:gap-3">
                <button onClick={() => generatePDFReport(selectedArchive)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600/20 text-red-400 px-4 sm:px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-red-600/30 transition-all"><Download className="w-4 h-4" /> PDF</button>
                <button onClick={() => generateExcelReport(selectedArchive)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-400 px-4 sm:px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-emerald-600/30 transition-all"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
              </div>

              {/* Classement serveurs */}
              {archiveWaiterStats.length > 0 && (
                <div>
                  <h4 className="text-sm sm:text-lg font-semibold text-white uppercase mb-3 sm:mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" /> Classement Serveurs</h4>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {archiveWaiterStats.map((stat, idx) => (
                      <div key={idx} className="bg-zinc-800 p-3 sm:p-4 rounded-xl flex items-center gap-2 sm:gap-3">
                        <span className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-[10px] sm:text-xs shrink-0 ${idx === 0 ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-800 text-zinc-500'}`}>{idx + 1}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-white uppercase truncate text-xs sm:text-sm">{stat.name}</p>
                          <p className="font-semibold text-zinc-400 text-xs sm:text-sm">{formatCurrency(stat.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail par Table */}
              {selectedArchive.detailedHistory && selectedArchive.detailedHistory.length > 0 && (
                <div>
                  <h4 className="text-sm sm:text-lg font-semibold text-white uppercase mb-3 sm:mb-4">Detail par Table</h4>
                  <div className="space-y-2 sm:space-y-3">
                    {selectedArchive.detailedHistory.map((entry: any, idx: number) => (
                      <div key={idx} className="bg-zinc-800 p-3 sm:p-4 rounded-xl">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                              <span className="text-zinc-400 font-semibold text-sm">T{entry.tableNumber}</span>
                              <span className="text-white font-bold uppercase text-sm truncate">{entry.clientName}</span>
                            </div>
                            {entry.waiterName && <span className="text-zinc-500 text-[10px] sm:text-xs">({entry.waiterName})</span>}
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <span className="text-sm sm:text-lg font-semibold text-white whitespace-nowrap">{entry.totalAmount.toFixed(0)} EUR</span>
                            {isAdmin && <button onClick={() => setEditingRecapEntry({ entry, index: idx })} className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700 rounded-lg transition-all" title="Modifier le recap"><Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingApporteur && editingApporteur.name === entry.clientName ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input type="text" value={editingApporteur.value} onChange={(e) => setEditingApporteur({...editingApporteur, value: e.target.value.toUpperCase()})} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg py-1 px-2 sm:px-3 text-white text-xs uppercase outline-none" autoFocus />
                              <button onClick={handleSaveApporteur} className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => setEditingApporteur(null)} className="p-1 bg-red-500/20 text-red-400 rounded-lg"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <>
                              <span className="text-[10px] sm:text-xs font-semibold text-zinc-400 uppercase px-2 py-1 bg-zinc-900 rounded-lg">{entry.apporteur || 'Aucun apporteur'}</span>
                              <button onClick={() => setEditingApporteur({ name: entry.clientName, value: entry.apporteur || '' })} className="p-1 text-zinc-600 hover:text-zinc-400"><Edit3 className="w-3 h-3" /></button>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-zinc-500 mt-2 line-clamp-2">{entry.items?.join(', ') || 'Aucun detail'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mb-8">
              <button onClick={() => generatePDFReport(selectedArchive)} className="flex items-center gap-2 bg-red-600/20 text-red-400 px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-red-600/30 transition-all"><Download className="w-4 h-4" /> PDF</button>
              <button onClick={() => generateExcelReport(selectedArchive)} className="flex items-center gap-2 bg-emerald-600/20 text-emerald-400 px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-emerald-600/30 transition-all"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
              <button
                onClick={async () => {
                  setRecalculating(true);
                  setRecalcStatus('Lancement...');
                  try {
                    if (typeof recoverEvent !== 'function') {
                      setRecalcStatus('ERREUR: recoverEvent non disponible');
                      return;
                    }
                    setRecalcStatus(`Recalcul event ${selectedArchive.id.slice(0, 8)}...`);
                    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 15s')), 15000));
                    const result: any = await Promise.race([recoverEvent(selectedArchive.id), timeout]);
                    const updated = useStore.getState().pastEvents.find(e => e.id === selectedArchive.id);
                    if (updated) setSelectedArchive(updated);
                    if (result?.error) {
                      setRecalcStatus(`ERREUR: ${result.error} (orders: ${result.orders ?? '?'}, served: ${result.served ?? '?'})`);
                    } else {
                      setRecalcStatus(`OK: ${result?.orders ?? '?'} orders, ${result?.served ?? '?'} served, CA: ${result?.revenue ?? 0}€`);
                    }
                  } catch (err: any) {
                    setRecalcStatus(`ERREUR: ${err?.message || String(err)}`);
                  } finally {
                    setRecalculating(false);
                  }
                }}
                disabled={recalculating}
                className="flex items-center gap-2 bg-amber-600/20 text-amber-400 px-6 py-3 rounded-xl font-medium uppercase text-xs hover:bg-amber-600/30 transition-all disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} /> {recalculating ? 'Recalcul...' : 'Recalculer'}
              </button>
              {recalcStatus && (
                <div className={`px-4 py-2 rounded-lg text-xs font-mono ${recalcStatus.startsWith('ERREUR') ? 'bg-red-500/20 text-red-400' : recalcStatus.startsWith('OK') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  {recalcStatus}
                </div>
              )}
            </div>
            {archiveWaiterStats.length > 0 && (
              <div className="mb-8"><h4 className="text-lg font-semibold text-white uppercase mb-4 flex items-center gap-2"><Trophy className="w-5 h-5 text-zinc-400" /> Classement Serveurs</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{archiveWaiterStats.map((stat, idx) => (<div key={idx} className="bg-zinc-800 p-4 rounded-xl flex items-center gap-3"><span className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 ${idx === 0 ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-800 text-zinc-500'}`}>{idx + 1}</span><div className="min-w-0"><p className="font-bold text-white uppercase truncate">{stat.name}</p><p className="font-semibold text-zinc-400 text-sm">{formatCurrency(stat.revenue)}</p></div></div>))}</div></div>
            )}
            {selectedArchive.detailedHistory && selectedArchive.detailedHistory.length > 0 && (
              <div><h4 className="text-lg font-semibold text-white uppercase mb-4">Detail par Table</h4><div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">{selectedArchive.detailedHistory.map((entry: any, idx: number) => (<div key={idx} className="bg-zinc-800 p-4 rounded-xl"><div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2 mb-2"><div className="min-w-0"><span className="text-zinc-400 font-semibold">T{entry.tableNumber}</span><span className="text-white font-bold ml-3 uppercase">{entry.clientName}</span>{entry.waiterName && <span className="text-zinc-500 text-xs ml-2 block sm:inline">({entry.waiterName})</span>}</div><div className="flex items-center gap-2 self-center sm:self-auto shrink-0"><span className="text-lg font-semibold text-white">{entry.totalAmount.toFixed(0)} EUR</span>{isAdmin && <button onClick={() => setEditingRecapEntry({ entry, index: idx })} className="p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 rounded-lg transition-all" title="Modifier le recap"><Pencil className="w-4 h-4" /></button>}</div></div><div className="flex items-center gap-2">{editingApporteur && editingApporteur.name === entry.clientName ? (<div className="flex items-center gap-2 flex-1"><input type="text" value={editingApporteur.value} onChange={(e) => setEditingApporteur({...editingApporteur, value: e.target.value.toUpperCase()})} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-1 px-3 text-white text-xs uppercase outline-none" autoFocus /><button onClick={handleSaveApporteur} className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg"><Edit3 className="w-4 h-4" /></button><button onClick={() => setEditingApporteur(null)} className="p-1 bg-red-500/20 text-red-400 rounded-lg"><X className="w-4 h-4" /></button></div>) : (<><span className="text-xs font-semibold text-zinc-400 uppercase px-2 py-1 bg-zinc-800 rounded-lg">{entry.apporteur || 'Aucun apporteur'}</span><button onClick={() => setEditingApporteur({ name: entry.clientName, value: entry.apporteur || '' })} className="p-1 text-zinc-600 hover:text-zinc-400"><Edit3 className="w-3 h-3" /></button></>)}</div><p className="text-xs text-zinc-500 mt-2">{entry.items?.join(', ') || 'Aucun detail'}</p></div>))}</div></div>
            )}
            {editingRecapEntry && (
              <EditRecapModal
                isOpen={true}
                entry={editingRecapEntry.entry}
                entryIndex={editingRecapEntry.index}
                onSave={handleSaveRecapEntry}
                onDelete={handleDeleteRecapEntry}
                onClose={() => setEditingRecapEntry(null)}
              />
            )}

            {/* Bottom close button */}
            <button onClick={() => setSelectedArchive(null)} className="w-full mt-4 sm:mt-8 bg-zinc-800 text-white py-3 sm:py-4 rounded-xl font-semibold uppercase text-sm hover:bg-zinc-700 transition-all shrink-0">Fermer</button>
          </div>
        </div>
      )}

      {/* MODAL CLIENT DETAIL */}
      {showDetailModal && selectedClientForDetail && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-enter">
          <div className="bg-zinc-950 border border-zinc-800 rounded-t-[3rem] sm:rounded-xl p-8 w-full max-w-lg max-h-[90vh] flex flex-col modal-enter border-gradient">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-semibold text-white uppercase tracking-tighter">{selectedClientForDetail.name}</h3>
                <p className="text-zinc-400 text-xs font-bold uppercase mt-1">
                  {tables.find(t => t.id === selectedClientForDetail.tableId)?.number ? `Table ${tables.find(t => t.id === selectedClientForDetail.tableId)?.number}` : 'Sans Table'}
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-zinc-500 hover:text-white"><X className="w-8 h-8" /></button>
            </div>

            {/* Tables liées avec bouton Dissocier */}
            {selectedClientForDetail.linkedTableIds && selectedClientForDetail.linkedTableIds.length > 0 && (
              <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <p className="text-xs font-semibold text-blue-400 uppercase mb-2">Tables liées</p>
                <div className="flex flex-wrap gap-2">
                  {selectedClientForDetail.linkedTableIds.map(ltId => {
                    const linkedTable = tables.find(t => t.id === ltId);
                    return linkedTable ? (
                      <div key={ltId} className="flex items-center gap-2 bg-blue-500/20 px-3 py-2 rounded-xl">
                        <span className="text-white font-bold text-sm">T{linkedTable.number}</span>
                        <button
                          onClick={() => {
                            if (confirm(`Dissocier la table ${linkedTable.number} de ${selectedClientForDetail.name} ?`)) {
                              unlinkTableFromClient(selectedClientForDetail.id, ltId);
                              addNotification({ type: 'info', title: 'DISSOCIÉ', message: `Table ${linkedTable.number} dissociée.` });
                            }
                          }}
                          className="p-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="Dissocier cette table"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <div className="text-center py-6 bg-zinc-800 rounded-xl mb-6">
              <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Total Actuel</p>
              <p className="text-5xl font-semibold text-white">{getClientTotal(selectedClientForDetail).toFixed(0)}EUR</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-6">
              {orders.filter(o => o.clientId === selectedClientForDetail.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(order => (
                <div key={order.id} className={`p-4 rounded-xl border ${(order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED) ? (order.status === OrderStatus.SETTLED ? 'bg-blue-500/5 border-blue-500/10' : 'bg-emerald-500/5 border-emerald-500/10') : order.status === OrderStatus.PENDING ? 'bg-amber-500/5 border-amber-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${order.status === OrderStatus.SETTLED ? 'bg-blue-500/20 text-blue-400' : order.status === OrderStatus.SERVED ? 'bg-emerald-500/20 text-emerald-500' : order.status === OrderStatus.PENDING ? 'bg-amber-500/20 text-amber-500' : 'bg-red-500/20 text-red-500'}`}>{order.status === OrderStatus.SETTLED ? 'Encaissé' : order.status}</span>
                    <span className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="space-y-1">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs text-zinc-400">
                        <span>
                          <span className="text-white font-bold">{item.quantity}x</span> {item.productName} <span className="text-zinc-500">({item.size})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300">{item.subtotal}EUR</span>
                          {(order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED) && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setAdminEditingPrice({ orderId: order.id, itemId: item.id, currentPrice: item.unitPrice, productName: item.productName }); setAdminNewPriceValue(item.unitPrice.toString()); setAdminEditReason(''); }}
                                className="p-1 rounded-lg bg-zinc-800 hover:bg-amber-500/20 text-zinc-500 hover:text-amber-400 transition-all"
                                title="Modifier prix"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setAdminRemovingItem({ orderId: order.id, itemId: item.id, itemName: item.productName }); setAdminRemoveReason(''); }}
                                className="p-1 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-all"
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
                  {/* Bouton annuler commande (SERVED ou PENDING) */}
                  {(order.status === OrderStatus.SERVED || order.status === OrderStatus.SETTLED || order.status === OrderStatus.PENDING) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAdminCancellingOrderId(order.id); setAdminCancelReason(''); }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Annuler la commande
                    </button>
                  )}
                  {/* Affichage motif annulation */}
                  {order.status === OrderStatus.CANCELLED && order.cancelReason && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 text-xs font-semibold uppercase flex items-center gap-2 mb-1">
                        <XCircle className="w-3 h-3" /> Commande annulee
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
              ))}
            </div>

            {/* =====================================================
                NEW BOUTONS CLIENT ENCAISSE (CLOSED)
                - Liberer Table (tout le monde)
                - Reouvrir (SEULEMENT GERANT)
            ===================================================== */}
            {selectedClientForDetail.status === 'closed' ? (
              <div className="space-y-3">
                {/* NEW Bouton Reouvrir - VISIBLE UNIQUEMENT POUR LE GERANT */}
                {isAdmin && (
                  <button 
                    onClick={handleReopenClient} 
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black py-5 rounded-xl font-semibold uppercase flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <RotateCw className="w-5 h-5" /> Reouvrir le Client
                  </button>
                )}
                <button 
                  onClick={handleFreeTable} 
                  className="w-full bg-purple-600 text-white py-5 rounded-xl font-semibold uppercase flex items-center justify-center gap-3"
                >
                  <LogOut className="w-5 h-5" /> Liberer Table
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setShowDetailModal(false); setShowOrderModal(true); }} className="bg-white text-black py-4 rounded-xl font-semibold text-xs uppercase">+ Commande</button>
                  <button onClick={() => { setTargetTableId(''); setShowTransferModal(true); }} className="bg-zinc-800 text-white py-4 rounded-xl font-semibold text-xs uppercase">Transferer</button>
                  <button onClick={() => { setTargetWaiterId(''); setShowHandoverModal(true); }} className="bg-zinc-800 text-white py-4 rounded-xl font-semibold text-xs uppercase flex items-center justify-center gap-1"><Handshake className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUnassignClient} className="p-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20"><UserMinus className="w-5 h-5" /></button>
                  <button onClick={() => { setShowDetailModal(false); setShowLinkTableModal(true); }} className="p-4 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20"><Link className="w-5 h-5" /></button>
                  <button onClick={handleSettlePayment} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-medium uppercase">Encaisser</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TRANSFER */}
      {showTransferModal && selectedClientForDetail && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-t-[3rem] sm:rounded-xl p-10 w-full max-w-md h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-semibold text-white uppercase">Transferer Table</h3>
                <p className="text-zinc-400 text-xs font-bold uppercase">{selectedClientForDetail.name}</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {availableTables.map(t => (
                <button key={t.id} onClick={() => setTargetTableId(t.id)} className={`w-full py-6 px-8 rounded-xl font-semibold text-2xl flex justify-between items-center border-2 transition-all ${targetTableId === t.id ? 'bg-white border-white text-black' : 'bg-zinc-800 border-zinc-800 text-white'}`}>
                  <span>T{t.number}</span>
                </button>
              ))}
            </div>
            <button onClick={handleTransferClient} disabled={!targetTableId} className="w-full mt-6 bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-xl font-medium uppercase">Transferer</button>
          </div>
        </div>
      )}

      {/* MODAL HANDOVER */}
      {showHandoverModal && selectedClientForDetail && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-t-[3rem] sm:rounded-xl p-10 w-full max-w-md h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-semibold text-white uppercase">Changer Serveur</h3>
                <p className="text-zinc-400 text-xs font-bold uppercase">{selectedClientForDetail.name}</p>
              </div>
              <button onClick={() => setShowHandoverModal(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {activeWaiters.map(w => (
                <button key={w.id} onClick={() => setTargetWaiterId(w.id)} className={`w-full py-6 px-8 rounded-xl font-semibold text-xl flex justify-between items-center border-2 transition-all ${targetWaiterId === w.id ? 'bg-white border-white text-black' : 'bg-zinc-800 border-zinc-800 text-white'}`}>
                  <span>{w.firstName} {w.lastName}</span>
                </button>
              ))}
            </div>
            <button onClick={handleHandoverClient} disabled={!targetWaiterId} className="w-full mt-6 bg-emerald-600 disabled:opacity-30 text-white py-5 rounded-xl font-medium uppercase">Transferer</button>
          </div>
        </div>
      )}

      {/* MODAL LINK TABLE */}
      {showLinkTableModal && selectedClientForDetail && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-t-[3rem] sm:rounded-xl p-10 w-full max-w-md h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-semibold text-white uppercase">Lier une Table</h3>
                <p className="text-zinc-400 text-xs font-bold uppercase">{selectedClientForDetail.name}</p>
              </div>
              <button onClick={() => setShowLinkTableModal(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {availableTables.map(t => (
                <button key={t.id} onClick={() => setTargetTableId(t.id)} className={`w-full py-6 px-8 rounded-xl font-semibold text-2xl flex justify-between items-center border-2 transition-all ${targetTableId === t.id ? 'bg-blue-500 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-800 text-white'}`}>
                  <span>T{t.number}</span>
                </button>
              ))}
            </div>
            <button onClick={handleLinkTableSubmit} disabled={!targetTableId} className="w-full mt-6 bg-blue-600 disabled:opacity-30 text-white py-5 rounded-xl font-medium uppercase">Lier la Table</button>
          </div>
        </div>
      )}

      {/* MODAL ADMIN : Annuler commande */}
      {adminCancellingOrderId && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4" onClick={() => setAdminCancellingOrderId(null)}>
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-red-400 font-semibold uppercase text-sm flex items-center gap-2"><XCircle className="w-4 h-4" /> Annuler la commande</h3>
            <p className="text-zinc-400 text-sm">Cette action est irreversible. La commande sera marquee comme annulee.</p>
            <div>
              <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Motif (obligatoire)</label>
              <input
                type="text"
                value={adminCancelReason}
                onChange={e => setAdminCancelReason(e.target.value)}
                placeholder="Ex: changement de bouteille, erreur..."
                className="w-full bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAdminCancellingOrderId(null)} className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs uppercase transition-all flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Retour
              </button>
              <button onClick={handleAdminCancelOrder} disabled={!adminCancelReason.trim()} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-xs uppercase transition-all flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4" /> Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN : Modifier prix */}
      {adminEditingPrice && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4" onClick={() => setAdminEditingPrice(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold uppercase text-sm flex items-center gap-2"><Pencil className="w-4 h-4" /> Modifier le prix</h3>
            <p className="text-zinc-400 text-sm">{adminEditingPrice.productName} - Prix actuel : <span className="text-white font-bold">{adminEditingPrice.currentPrice}EUR</span></p>
            <div>
              <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Nouveau prix unitaire</label>
              <input
                type="number"
                value={adminNewPriceValue}
                onChange={e => setAdminNewPriceValue(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-amber-500/50"
                min="0" step="1" autoFocus
              />
            </div>
            <div>
              <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Motif (obligatoire)</label>
              <input
                type="text"
                value={adminEditReason}
                onChange={e => setAdminEditReason(e.target.value)}
                placeholder="Ex: erreur de saisie, remise..."
                className="w-full bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAdminEditingPrice(null)} className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs uppercase transition-all flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Annuler
              </button>
              <button onClick={handleAdminPriceEdit} disabled={!adminEditReason.trim() || !adminNewPriceValue} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold text-xs uppercase transition-all flex items-center justify-center gap-2">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMIN : Retirer article */}
      {adminRemovingItem && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4" onClick={() => setAdminRemovingItem(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold uppercase text-sm">Retirer un article</h3>
            <p className="text-zinc-400 text-sm">Retirer <span className="text-white font-bold">{adminRemovingItem.itemName}</span> de cette commande ?</p>
            <div>
              <label className="text-zinc-500 text-xs font-bold uppercase block mb-1">Motif (obligatoire)</label>
              <input
                type="text"
                value={adminRemoveReason}
                onChange={e => setAdminRemoveReason(e.target.value)}
                placeholder="Ex: erreur, client ne veut plus..."
                className="w-full bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500/50"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAdminRemovingItem(null)} className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-800 text-zinc-400 font-bold text-xs uppercase transition-all flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Annuler
              </button>
              <button onClick={handleAdminRemoveItem} disabled={!adminRemoveReason.trim()} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-xs uppercase transition-all flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Retirer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ORDER */}
      {showOrderModal && selectedClientForDetail && (
        <Suspense fallback={<LoadingSpinner />}>
          <AdminOrderModal client={selectedClientForDetail} onClose={() => setShowOrderModal(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default AdminDashboard;