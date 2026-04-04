/**
 * TYPES - Définitions TypeScript centralisées
 * Fresh Touch Optimization - Day 1
 * 
 * Ce fichier remplace l'ancien /src/types.ts
 * Usage: import { UserRole, Client, Order } from '../types';
 */

// ==========================================
// ENUMS
// ==========================================

export enum UserRole {
  HOSTESS = 'hotesse',
  WAITER = 'chef de rang',
  MANAGER = 'manager',
  ADMIN = 'gérant',
  VIEWER = 'viewer',
  BARMAID = 'barmaid',
  COMMIS = 'commis'
}

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  SERVED = 'served',
  TO_PAY = 'to_pay',
  DISABLED = 'disabled'
}

export enum OrderStatus {
  PENDING = 'pending',
  SERVED = 'served',
  SETTLED = 'settled',
  CANCELLED = 'cancelled'
}

export enum EventStatus {
  ACTIVE = 'active',
  CLOSED = 'closed'
}

// ==========================================
// 🆕 RÉSERVATIONS - STATUTS & CONFIGURATION
// ==========================================

export enum ReservationStatus {
  EN_ATTENTE = 'en_attente',   // Réservation créée
  VENU = 'venu',               // Client physiquement arrivé
  CONFIRME = 'confirme',       // Client a commandé (bouteille)
  NO_SHOW = 'no_show',         // Pas venu
  RECALE = 'recale'            // Refusé à l'entrée
}

// Configuration UI pour chaque statut
export interface ReservationStatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'Clock' | 'UserCheck' | 'CheckCircle' | 'UserX' | 'Ban';
  description: string;
  allowedTransitions: ReservationStatus[];
}

export const RESERVATION_STATUS_CONFIG: Record<ReservationStatus, ReservationStatusConfig> = {
  [ReservationStatus.EN_ATTENTE]: {
    label: 'En attente',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: 'Clock',
    description: 'Réservation en attente de confirmation',
    allowedTransitions: [ReservationStatus.VENU, ReservationStatus.NO_SHOW, ReservationStatus.RECALE]
  },
  [ReservationStatus.VENU]: {
    label: 'Venu',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    icon: 'UserCheck',
    description: 'Client arrivé sur place',
    allowedTransitions: [ReservationStatus.CONFIRME, ReservationStatus.NO_SHOW, ReservationStatus.RECALE]
  },
  [ReservationStatus.CONFIRME]: {
    label: 'Confirmé',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: 'CheckCircle',
    description: 'Client a commandé',
    allowedTransitions: []
  },
  [ReservationStatus.NO_SHOW]: {
    label: 'No show',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: 'UserX',
    description: 'Client non venu',
    allowedTransitions: []
  },
  [ReservationStatus.RECALE]: {
    label: 'Recalé',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: 'Ban',
    description: 'Client refusé à l\'entrée',
    allowedTransitions: []
  }
};

// Mapping pour migration des anciennes valeurs
export const LEGACY_STATUS_MAP: Record<string, ReservationStatus> = {
  'pending': ReservationStatus.EN_ATTENTE,
  'confirmed': ReservationStatus.EN_ATTENTE,
  'converted': ReservationStatus.CONFIRME,
  'cancelled': ReservationStatus.RECALE,
  'no_show': ReservationStatus.NO_SHOW
};

// Helper pour obtenir le statut normalisé (migration)
export const normalizeReservationStatus = (status: string): ReservationStatus => {
  if (Object.values(ReservationStatus).includes(status as ReservationStatus)) {
    return status as ReservationStatus;
  }
  return LEGACY_STATUS_MAP[status] || ReservationStatus.EN_ATTENTE;
};

// ==========================================
// INTERFACES - Entités principales
// ==========================================

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  pin: string;
  isActive: boolean;
  totalRevenue?: number;
}

export interface Table {
  id: string;
  number: string;
  capacity: number;
  type: 'standard' | 'vip' | 'carre';
  status: TableStatus;
  positionX: number;
  positionY: number;
  zone?: 'club' | 'bar';
}

export interface Client {
  id: string;
  eventId: string;
  name: string;
  businessProvider?: string;
  tableId?: string;           // Table Principale
  linkedTableIds?: string[];  // Tables Annexes
  waiterId?: string;
  createdById?: string;
  createdByName?: string;
  status: ClientStatus;
  totalSpent: number;
  notes?: string;
  arrivalAt: string;
  // 🆕 Champs ajoutés pour les clients issus de réservations
  reservationId?: string;
  reservationTime?: string;
  numberOfGuests?: number;
  tablePreference?: string;
  phoneNumber?: string;
  isFromReservation?: boolean;
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  prices: {
    standard?: number;
    magnum?: number;
    jeroboam?: number;
    mathusalem?: number;
  };
}

// ==========================================
// INTERFACES - Commandes
// ==========================================

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  size: BottleSize;
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  subtotal: number;
}

export interface RemovedOrderItem extends OrderItem {
  removedAt: string;
  removedBy: string;
}

export interface Order {
  id: string;
  eventId: string;
  clientId: string;
  tableId: string;
  waiterId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  note?: string;
  createdAt: string;
  validatedAt?: string;
  cancelReason?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  removedItems?: RemovedOrderItem[];
}

// ==========================================
// INTERFACES - Événements & Archives
// ==========================================

export interface ArchiveStructuredItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ArchiveTableEntry {
  clientName: string;
  tableNumber: string;
  apporteur: string;
  waiterName?: string;
  totalAmount: number;
  items: string[];
  zone?: 'club' | 'bar';
  structuredItems?: ArchiveStructuredItem[];
}

export interface EveningEvent {
  id: string;
  date: string;
  name?: string;
  startTime: string;
  endTime?: string;
  status: EventStatus;
  totalRevenue: number;
  clubRevenue?: number;
  barRevenue?: number;
  clientCount?: number;
  orderCount?: number;
  waiterStats?: { name: string; revenue: number; tablesCount?: number; tables?: number }[];
  detailedHistory?: ArchiveTableEntry[];
}

// ==========================================
// 🆕 INTERFACES - Réservations
// ==========================================

export interface Reservation {
  id: string;
  clientName: string;
  nickname?: string;
  businessProvider: string;
  date: string;                 // Format YYYY-MM-DD
  time?: string;                // "21:00"
  numberOfGuests?: number;
  notes?: string;
  tablePreference?: string;
  phoneNumber?: string;
  status: ReservationStatus;
  createdAt: string;
  createdById: string;
  createdByName: string;
  convertedToClientId?: string;
  totalSpent?: number;
  // 🆕 Timestamps pour les transitions de statut
  arrivedAt?: string;           // Quand le statut passe à 'venu' (client arrivé)
  confirmedAt?: string;         // Quand le statut passe à 'confirme' (auto sur commande)
  refusedAt?: string;           // Quand le statut passe à 'recale'
  noShowAt?: string;            // Quand le statut passe à 'no_show'
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
}

export interface CreateReservationData {
  clientName: string;
  nickname?: string;
  date: string;
  businessProvider?: string;
  time?: string;
  numberOfGuests?: number;
  notes?: string;
  tablePreference?: string;
  phoneNumber?: string;
  customerId?: string | null;
  customerSnapshot?: HubCustomerSnapshot | null;
  apporteurId?: string | null;
  apporteurSnapshot?: HubApporteurSnapshot | null;
}

// ==========================================
// INTERFACES - Système
// ==========================================

export interface AuditLog {
  id: string;
  eventId: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  priority: 'normal' | 'high' | 'critical';
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  targetUserId?: string;
  targetRoles?: UserRole[];
  timestamp: string;
}

// ==========================================
// TYPES UTILITAIRES
// ==========================================

/** Type pour les tailles de bouteilles */
export type BottleSize = 'standard' | 'magnum' | 'jeroboam' | 'mathusalem';

/** Enum pour les statuts client */
export enum ClientStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  CLOSED = 'closed'
}

/** Type pour les types de table */
export type TableType = 'standard' | 'vip' | 'carre';

/** Type pour les priorités de log */
export type LogPriority = 'normal' | 'high' | 'critical';

/** Type pour les types de notification */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// ============================================
// CAISSE
// ============================================
export interface CreditClient {
  id: string;
  lastName: string;
  firstName: string;
  amount: number;
}

export interface CaisseData {
  id: string;
  eventId: string;
  vestiaire: number;
  caSalle: number;
  bar: number;
  petitBar?: number;
  vuse?: number;
  ttc: number;
  ht: number;
  nbPax?: number;
  noteSoiree: string;
  creditClients: CreditClient[];
  salleOverride?: number | null;
  savedOk?: boolean;
  updatedAt: string;
  updatedBy: string;
}

// ==========================================
// HUB CRM — Customers
// ==========================================

export type HubCustomerTag = 'vip' | 'regular' | 'blacklist' | 'watchlist';

export interface HubCustomer {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  displayName: string;
  displayNameSearch: string;
  phone: string | null;
  email: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdByName?: string | null;
  tags: HubCustomerTag[];
  totalVisits: number;
  totalRevenue: number;
  vipScore: number;
}

export interface HubCustomerSnapshot {
  customerId: string;
  displayName: string;
  nickname: string | null;
  tags: HubCustomerTag[];
  vipScore: number;
}

// ==========================================
// HUB CRM — Apporteurs
// ==========================================

export interface HubApporteur {
  id: string;
  name: string;
  displayNameSearch: string;
  phone: string | null;
  email: string | null;
}

export interface HubApporteurSnapshot {
  apporteurId: string;
  name: string;
}

// ==========================================
// INTERFACES — Factures
// ==========================================

export interface InvoiceRow {
  id: string;
  description: string;
  prixUnitaire: number | '';
}

export interface InvoiceClient {
  nom: string;
  adresse: string;
  ville: string;
  cp: string;
  tel: string;
  email: string;
}

export interface InvoiceEntity {
  id: string;
  nom: string;
  logo: string;
  siege: string;
  tva: string;
  siren: string;
  contact: string;
  bgColor: string;
}

export interface Invoice {
  id: string;
  numero: string;
  dateEvenement: string;
  dateFacture: string;
  entity: InvoiceEntity;
  client: InvoiceClient;
  rows: InvoiceRow[];
  totalTTC: number;
  tva: number;
  netAPayer: number;
  status: 'draft' | 'sent' | 'paid';
  createdAt: string;
  createdById: string;
  createdByName: string;
  updatedAt?: string;
}

// ==========================================
// STOCK / BAR — Stub types for store compatibility
// ==========================================

export type BottleFormat = 'standard' | 'magnum' | 'jeroboam' | 'mathusalem';

export type MovementType = 'purchase' | 'vip_order' | 'vip_order_cancel' | 'inventory_adjustment' | 'bar_send' | 'bar_return' | 'loss' | 'manual';

export interface StockItem {
  id: string;
  productName: string;
  category: string;
  format: BottleFormat;
  currentQuantity: number;
  sellingPrice: number;
  purchasePriceHT?: number;
  threshold: number;
  isArchived: boolean;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  type: MovementType;
  quantity: number;
  direction: 'in' | 'out';
  reason?: string;
  orderId?: string;
  inventoryId?: string;
  deliveryRef?: string;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  stockItemId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface Inventory {
  id: string;
  status: 'in_progress' | 'validated';
  startedAt: string;
  validatedAt?: string;
}

export interface BarSession {
  id: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

export interface BarItem {
  id: string;
  sessionId: string;
  stockItemId: string;
  productName: string;
  format: BottleFormat;
  quantitySent: number;
  quantityEmpty: number;
  quantityReturned: number;
  returnedPercentage?: number;
}