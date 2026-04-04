// ============================================
// 📦 COMPOSANTS PARTAGÉS - DEFLOWER
// ============================================

// Cards
export { default as StatCard } from './StatCard';
export { default as TableCard } from './TableCard';
export { default as ClientCard } from './ClientCard';
export { default as OrderCard } from './OrderCard';

// UI States
export { default as EmptyState, EmptyStatePro, EmptyStateCompact } from './EmptyState';

// Loading States
export {
  Skeleton,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonTableRow,
  SkeletonList,
  SkeletonClientCard,
  SkeletonKPIGrid,
  FullPageLoader,
  InlineLoader,
  ButtonLoader,
} from './Skeleton';

// Notifications
export { ToastProvider, useToast } from './Toast';

// Reservation Status
export { default as ReservationStatusBadge } from './ReservationStatusBadge';
export { default as ReservationStatusDropdown } from './ReservationStatusDropdown';

// ============================================
// 💡 USAGE
// ============================================
//
// import { StatCard, TableCard, ClientCard, OrderCard, EmptyState } from './components';
// import { ToastProvider, useToast } from './components/ui';
// import { Skeleton, SkeletonCard, FullPageLoader } from './components/ui';
//
// // Toast usage
// const { success, error, warning, info } = useToast();
// success('Client ajouté', 'Jean Dupont a été enregistré');
//
// // Skeleton usage
// {isLoading ? <SkeletonList count={3} /> : <RealContent />}
//
// // Empty State usage
// <EmptyStatePro type="clients" action={{ label: "Ajouter", onClick: handleAdd }} />
