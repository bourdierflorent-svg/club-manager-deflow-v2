import type { StoreGet, StoreSet } from '../types';
import type { MovementType, BottleFormat } from '../../src/types';
import { secureLog } from '../../src/utils';

// NOTE: Stock tables (stockItems, stockMovements, stockAlerts, inventories)
// do not exist yet in the Supabase schema. These actions are no-op stubs
// to prevent runtime crashes. They will be implemented when the tables are created.

const STUB_WARN = '[STUB] Stock module not yet migrated to Supabase';

export const createStockActions = (set: StoreSet, get: StoreGet) => ({

  createStockReference: async (_params: {
    productName: string;
    category: string;
    formats: { format: BottleFormat; sellingPrice: number; purchasePriceHT?: number }[];
  }) => {
    secureLog(STUB_WARN + ' - createStockReference');
  },

  createStockMovement: async (_params: {
    stockItemId: string;
    type: MovementType;
    quantity: number;
    direction: 'in' | 'out';
    reason?: string;
    orderId?: string;
    inventoryId?: string;
    deliveryRef?: string;
  }) => {
    secureLog(STUB_WARN + ' - createStockMovement');
  },

  updateStockItemThreshold: async (_stockItemId: string, _threshold: number) => {
    secureLog(STUB_WARN + ' - updateStockItemThreshold');
  },

  archiveStockItem: async (_stockItemId: string) => {
    secureLog(STUB_WARN + ' - archiveStockItem');
  },

  deleteStockItem: async (_stockItemId: string) => {
    secureLog(STUB_WARN + ' - deleteStockItem');
  },

  deleteAllStockItems: async () => {
    secureLog(STUB_WARN + ' - deleteAllStockItems');
  },

  startInventory: async (): Promise<string | null> => {
    secureLog(STUB_WARN + ' - startInventory');
    return null;
  },

  saveInventoryCount: async (_inventoryId: string, _stockItemId: string, _countedQuantity: number) => {
    secureLog(STUB_WARN + ' - saveInventoryCount');
  },

  validateInventory: async (_inventoryId: string) => {
    secureLog(STUB_WARN + ' - validateInventory');
  },

  markAlertRead: async (_alertId: string) => {
    secureLog(STUB_WARN + ' - markAlertRead');
  },
});
