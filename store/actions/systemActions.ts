import type { StoreGet, StoreSet } from '../types';
import { OrderStatus } from '../../src/types';
import {
  createSession, clearSession,
  secureLog, secureError
} from '../../src/utils';
import { supabase } from '../../supabaseConfig';
import { logSync } from '../helpers';

export const createSystemActions = (set: StoreSet, get: StoreGet) => ({

  forceResync: () => {
    logSync("Force resync triggered -- reloading to re-initialize all Supabase listeners");
    window.location.reload();
  },

  login: (pin: string, userId: string) => {
    const user = get().users.find(u => u.id === userId && u.pin === pin);
    if (user) {
      set({ currentUser: user });
      createSession(user.id, user);
      secureLog(`Login: ${user.firstName}`);
      return true;
    }
    return false;
  },

  logout: () => {
    secureLog("Logout");
    set({ currentUser: null });
    clearSession();
    sessionStorage.clear();
  },

  logAction: async (uId: string, uN: string, a: string, d: string, priority: 'normal' | 'high' | 'critical' = 'normal') => {
    const { currentEvent, clubId } = get();
    if (!clubId) return;
    try {
      await supabase.from('audit_logs').insert({
        club_id: clubId,
        timestamp: new Date().toISOString(),
        user_id: uId || null,
        user_name: uN || '',
        action: a || '',
        details: d || '',
        priority,
        event_id: currentEvent?.id || null,
      });
    } catch (e) {
      secureError("[ERROR] [logAction] Error:", e);
    }
  },

  getSettledRevenue: (wId?: string) => get().clients.filter(c => c.status === 'closed' && (!wId || c.waiterId === wId)).reduce((acc, c) => acc + c.totalSpent, 0),

  getPendingRevenue: (wId?: string) => get().orders.filter(o => o.status === OrderStatus.SERVED && get().clients.find(c => c.id === o.clientId)?.status !== 'closed' && (!wId || o.waiterId === wId)).reduce((acc, o) => acc + o.totalAmount, 0),

  resetAllData: async (confirmed: boolean = false) => {
    if (!confirmed) {
      secureLog('[resetAllData] Appel sans confirmation -- operation annulee');
      return;
    }
    const { clubId } = get();
    if (!clubId) return;
    try {
      // Delete all event-related data for this club
      await supabase.from('orders').delete().eq('club_id', clubId);
      await supabase.from('clients').delete().eq('club_id', clubId);
      await supabase.from('event_tables').delete().eq('club_id', clubId);
      await supabase.from('events').delete().eq('club_id', clubId);

      localStorage.clear();
      window.location.reload();
    } catch (e) { secureError('[resetAllData] Error:', e); }
  },

});
