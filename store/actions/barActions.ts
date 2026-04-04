import type { StoreGet, StoreSet } from '../types';
import type { BarItem } from '../../src/types';
import { secureLog } from '../../src/utils';

// NOTE: Bar tables (barSessions, barItems) do not exist yet in the Supabase schema.
// These actions are no-op stubs to prevent runtime crashes.

const STUB_WARN = '[STUB] Bar module not yet migrated to Supabase';

export const createBarActions = (set: StoreSet, get: StoreGet) => ({

  openBarSession: async (): Promise<string | null> => {
    secureLog(STUB_WARN + ' - openBarSession');
    return null;
  },

  sendToBar: async (_sessionId: string, _stockItemId: string, _quantity: number) => {
    secureLog(STUB_WARN + ' - sendToBar');
  },

  returnFromBar: async (
    _sessionId: string,
    _barItemId: string,
    _quantityEmpty: number,
    _quantityReturned: number,
    _returnedPercentage?: number
  ) => {
    secureLog(STUB_WARN + ' - returnFromBar');
  },

  closeBarSession: async (_sessionId: string) => {
    secureLog(STUB_WARN + ' - closeBarSession');
  },

  loadBarItems: async (_sessionId: string): Promise<BarItem[]> => {
    secureLog(STUB_WARN + ' - loadBarItems');
    return [];
  },
});
