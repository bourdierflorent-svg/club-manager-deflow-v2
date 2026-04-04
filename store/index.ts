import { create } from 'zustand';
import type { LittleRoomState } from './types';
import { getStoredUser } from './helpers';
import { INITIAL_USERS, INITIAL_TABLES, INITIAL_PRODUCTS } from '../mockData';
import { createEveningActions } from './actions/eveningActions';
import { createClientActions } from './actions/clientActions';
import { createOrderActions } from './actions/orderActions';
import { createTableActions } from './actions/tableActions';
import { createReservationActions } from './actions/reservationActions';
import { createAdminActions } from './actions/adminActions';
import { createSystemActions } from './actions/systemActions';
import { createSupabaseActions } from './actions/supabaseActions';
import { createStockActions } from './actions/stockActions';
import { createBarActions } from './actions/barActions';
import { createCaisseActions } from './actions/caisseActions';
import { createInvoiceActions } from './actions/invoiceActions';

export const useStore = create<LittleRoomState>()((set, get) => ({
  // Initial state
  clubId: null,
  currentUser: getStoredUser(),
  users: INITIAL_USERS,
  tables: INITIAL_TABLES,
  clients: [],
  orders: [],
  products: INITIAL_PRODUCTS,
  currentEvent: null,
  pastEvents: [],
  auditLogs: [],
  isOnline: true,
  lastSyncTime: null,
  reservations: [],
  allReservations: [],
  stockItems: [],
  stockMovements: [],
  stockAlerts: [],
  currentInventory: null,
  currentBarSession: null,
  barItems: [],
  invoices: [],
  notifications: [],
  pendingWritesCount: 0,
  syncErrorCount: 0,

  // Actions grouped by domain
  ...createSystemActions(set, get),
  ...createEveningActions(set, get),
  ...createClientActions(set, get),
  ...createOrderActions(set, get),
  ...createTableActions(set, get),
  ...createReservationActions(set, get),
  ...createAdminActions(set, get),
  ...createSupabaseActions(set, get),
  ...createStockActions(set, get),
  ...createBarActions(set, get),
  ...createCaisseActions(set, get),
  ...createInvoiceActions(set, get),
}));
