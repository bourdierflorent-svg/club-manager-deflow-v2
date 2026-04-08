import type {
  User, Table, Client, Order, EveningEvent, AuditLog,
  TableStatus, OrderItem, Product, Reservation, CreateReservationData,
  StockItem, StockMovement, StockAlert, Inventory, MovementType, BottleFormat,
  BarSession, BarItem, CaisseData, HubCustomerSnapshot, HubApporteurSnapshot,
  Invoice, Notification
} from '../src/types';

export interface LittleRoomState {
  clubId: string | null;
  currentUser: User | null;
  users: User[];
  tables: Table[];
  clients: Client[];
  orders: Order[];
  products: Product[];
  currentEvent: EveningEvent | null;
  pastEvents: EveningEvent[];
  auditLogs: AuditLog[];
  isOnline: boolean;
  lastSyncTime: string | null;
  reservations: Reservation[];
  allReservations: Reservation[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  stockAlerts: StockAlert[];
  currentInventory: Inventory | null;
  currentBarSession: BarSession | null;
  barItems: BarItem[];
  invoices: Invoice[];
  notifications: Notification[];

  login: (pin: string, userId: string) => boolean;
  logout: () => void;
  startEvening: (date: string, name?: string) => Promise<void>;
  closeEvening: () => Promise<void>;
  createClient: (name: string, businessProvider?: string, tableId?: string, waiterId?: string, hubCustomerId?: string | null, hubSnapshot?: HubCustomerSnapshot | null, apporteurId?: string | null, apporteurSnapshot?: HubApporteurSnapshot | null) => Promise<void>;
  updateClientName: (clientId: string, newName: string) => Promise<void>;
  updateClientFull: (clientId: string, data: { name: string; businessProvider: string; customerId?: string | null }) => Promise<void>;
  updateClientBusinessProvider: (clientId: string, newApporteur: string) => Promise<void>;
  removeClient: (clientId: string) => Promise<void>;
  assignClient: (clientId: string, tableId: string, waiterId: string) => Promise<boolean>;
  unassignClient: (clientId: string) => Promise<void>;
  unlinkTableFromClient: (clientId: string, tableId: string) => Promise<void>;
  linkTableToClient: (clientId: string, tableId: string) => Promise<void>;
  transferClient: (clientId: string, newTableId: string) => Promise<boolean>;
  handoverClient: (clientId: string, newWaiterId: string) => Promise<void>;
  createOrder: (clientId: string, tableId: string, waiterId: string, items: OrderItem[], note?: string) => Promise<void>;

  removeItemFromPendingOrder: (orderId: string, itemId: string) => Promise<void>;
  removeItemFromServedOrder: (orderId: string, itemId: string) => Promise<void>;
  updateServedItemPrice: (orderId: string, itemId: string, newPrice: number, reason: string) => Promise<void>;

  validateOrder: (orderId: string, correctedPrices?: { itemId: string, price: number }[]) => Promise<void>;
  cancelOrder: (orderId: string, reason: string) => Promise<void>;
  settlePayment: (clientId: string) => Promise<void>;
  reopenClient: (clientId: string) => Promise<void>;
  freeTable: (tableId: string) => Promise<void>;
  addTable: (table: Table) => Promise<void>;

  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>;
  updateTablePosition: (tableId: string, x: number, y: number) => Promise<void>;

  addUser: (user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  deleteEvent: (eventId: string) => Promise<void>;
  repairArchive: (eventId: string) => Promise<void>;
  updateArchivedApporteur: (eventId: string, clientName: string, newApporteur: string) => Promise<void>;
  updateArchivedRecapEntry: (eventId: string, entryIndex: number, updatedEntry: any) => Promise<void>;
  deleteArchivedRecapEntry: (eventId: string, entryIndex: number) => Promise<void>;
  recoverEvent: (eventId: string) => Promise<any>;
  pendingWritesCount: number;
  syncErrorCount: number;

  logAction: (userId: string, userName: string, action: string, details: string, priority?: 'normal' | 'high' | 'critical') => Promise<void>;
  getSettledRevenue: (waiterId?: string) => number;
  getPendingRevenue: (waiterId?: string) => number;
  resetAllData: (confirmed?: boolean) => Promise<void>;
  initializeFromSupabase: () => () => void;
  forceResync: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;

  createReservation: (data: CreateReservationData) => Promise<void>;
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>;
  markReservationArrived: (id: string) => Promise<void>;
  markReservationVenu: (id: string) => Promise<void>;
  markReservationRefused: (id: string) => Promise<void>;
  markReservationNoShow: (id: string) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;
  getReservationsForDate: (date: string) => Reservation[];

  // Stock actions
  createStockReference: (params: {
    productName: string;
    category: string;
    formats: { format: BottleFormat; sellingPrice: number; purchasePriceHT?: number }[];
  }) => Promise<void>;
  createStockMovement: (params: {
    stockItemId: string;
    type: MovementType;
    quantity: number;
    direction: 'in' | 'out';
    reason?: string;
    orderId?: string;
    inventoryId?: string;
    deliveryRef?: string;
  }) => Promise<void>;
  updateStockItemThreshold: (stockItemId: string, threshold: number) => Promise<void>;
  archiveStockItem: (stockItemId: string) => Promise<void>;
  deleteStockItem: (stockItemId: string) => Promise<void>;
  deleteAllStockItems: () => Promise<void>;
  startInventory: () => Promise<string | null>;
  saveInventoryCount: (inventoryId: string, stockItemId: string, countedQuantity: number) => Promise<void>;
  validateInventory: (inventoryId: string) => Promise<void>;
  markAlertRead: (alertId: string) => Promise<void>;

  // Caisse actions
  loadCaisse: (eventId?: string) => Promise<CaisseData | null>;
  saveCaisse: (data: Partial<CaisseData>, eventId?: string) => Promise<void>;

  // Invoice actions
  createInvoice: (data: Omit<Invoice, 'id' | 'createdAt' | 'createdById' | 'createdByName'>) => Promise<string>;
  updateInvoice: (invoiceId: string, data: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (invoiceId: string) => Promise<void>;
  loadInvoices: () => Promise<void>;

  // Bar actions
  openBarSession: () => Promise<string | null>;
  sendToBar: (sessionId: string, stockItemId: string, quantity: number) => Promise<void>;
  returnFromBar: (sessionId: string, barItemId: string, quantityEmpty: number, quantityReturned: number, returnedPercentage?: number) => Promise<void>;
  closeBarSession: (sessionId: string) => Promise<void>;
  loadBarItems: (sessionId: string) => Promise<BarItem[]>;
}

export type StoreGet = () => LittleRoomState;
export type StoreSet = (
  partial: Partial<LittleRoomState> | ((state: LittleRoomState) => Partial<LittleRoomState>)
) => void;
