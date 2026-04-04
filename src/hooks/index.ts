/**
 * 📁 hooks/index.ts
 * Point d'entrée pour tous les hooks personnalisés
 * 
 * @example
 * import { 
 *   useWaiterStats, 
 *   useModals, 
 *   useClientActions,
 *   useOrderBasket 
 * } from '../hooks';
 */

// ============================================
// 📊 CALCULS ET STATISTIQUES
// ============================================

export {
  // Stats globales
  useWaiterStats,
  usePromoterStats,
  useArchiveWaiterStats,
  // Listes filtrées
  useAvailableTables,
  useActiveClients,
  usePendingClients,
  useActiveWaiters,
  usePendingOrders,
  useServedOrders,
  // Données serveur
  useWaiterTables,
  useWaiterClients,
  useWaiterSettledRevenue,
  useWaiterPendingRevenue,
  useWaiterSoldItems,
  // Stats soirée
  useTotalRevenue,
  useTotalSettledRevenue,
  useTotalPendingRevenue,
  useEveningCounters,
  // Données client
  useClientData,
  // Archives
  useSortedPastEvents,
} from './useCalculations';

export type {
  SoldItem,
  EveningCounters,
  ClientData,
} from './useCalculations';

// ============================================
// 🪟 MODALS
// ============================================

export {
  useModals,
  useConfirmModal,
} from './useModals';

export type {
  ModalType,
  ModalData,
  ModalState,
  UseModalsReturn,
  ConfirmOptions,
  UseConfirmModalReturn,
  BaseModalProps,
  ClientDetailModalProps,
  TransferModalProps,
  HandoverModalProps,
  AssignModalProps,
  ConfirmModalProps,
  NewClientModalProps,
} from './useModals';

// ============================================
// 👤 ACTIONS CLIENT
// ============================================

export {
  useClientActions,
  useWaiterClientActions,
} from './useClientActions';

export type {
  UseClientActionsReturn,
} from './useClientActions';

// ============================================
// 📦 ACTIONS COMMANDE
// ============================================

export {
  useOrderActions,
  useOrderBasket,
  useOrderForm,
} from './useOrderActions';

export type {
  UseOrderActionsReturn,
  UseOrderBasketReturn,
  UseOrderFormReturn,
  OrderStep,
} from './useOrderActions';

// ============================================
// 📤 EXPORT
// ============================================

export {
  useExport,
  useQuickExport,
} from './useExport';

export type {
  UseExportReturn,
  ExportOptions,
} from './useExport';

// ============================================
// 🔐 SESSION & SÉCURITÉ
// ============================================

export { useSessionMonitor } from './useSessionMonitor';
