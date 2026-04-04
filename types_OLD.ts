export enum UserRole {
  HOSTESS = 'hotesse',
  WAITER = 'chef de rang',
  MANAGER = 'manager',
  ADMIN = 'gérant',
  VIEWER = 'viewer'
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
  CANCELLED = 'cancelled'
}

export enum EventStatus {
  ACTIVE = 'active',
  CLOSED = 'closed'
}

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
}

export interface Client {
  id: string;
  eventId: string;
  name: string;
  businessProvider?: string;
  tableId?: string;           // Table Principale
  linkedTableIds?: string[];  // <--- NOUVEAU : Tables Annexes
  waiterId?: string;
  createdById?: string;
  createdByName?: string;
  status: 'pending' | 'assigned' | 'closed';
  totalSpent: number;
  notes?: string;
  arrivalAt: string;
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

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  size: 'standard' | 'magnum' | 'jeroboam' | 'mathusalem';
  quantity: number;
  unitPrice: number;
  originalPrice?: number;
  subtotal: number;
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
}

export interface ArchiveTableEntry {
  clientName: string;
  tableNumber: string;
  apporteur: string;
  waiterName?: string;
  totalAmount: number;
  items: string[];
}

export interface EveningEvent {
  id: string;
  date: string;
  name?: string;
  startTime: string;
  endTime?: string;
  status: EventStatus;
  totalRevenue: number;
  clientCount?: number;
  orderCount?: number;
  waiterStats?: { name: string; revenue: number; tablesCount: number }[];
  detailedHistory?: ArchiveTableEntry[];
}

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