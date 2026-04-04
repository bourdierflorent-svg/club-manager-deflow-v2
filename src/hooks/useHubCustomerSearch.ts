import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseConfig';
import { HubCustomer } from '../types';

interface SearchState {
  results: HubCustomer[];
  isLoading: boolean;
}

export function useHubCustomerSearch() {
  const [state, setState] = useState<SearchState>({ results: [], isLoading: false });

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setState({ results: [], isLoading: false });
      return;
    }
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const normalized = term.trim().toLowerCase();
      const pattern = `%${normalized}%`;

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},id.ilike.${pattern}`)
        .limit(8);

      if (error) {
        console.warn('[HubCustomerSearch] error:', error.message);
        setState({ results: [], isLoading: false });
        return;
      }

      const results: HubCustomer[] = (data ?? []).map(row => ({
        id: row.id,
        firstName: row.first_name ?? '',
        lastName: row.last_name ?? '',
        nickname: null,
        displayName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        displayNameSearch: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim().toLowerCase(),
        phone: row.phone ?? null,
        email: row.email ?? null,
        tags: row.tags ?? [],
        totalVisits: 0,
        totalRevenue: row.total_revenue ?? 0,
        vipScore: row.vip_score ?? 0,
      }));

      setState({ results, isLoading: false });
    } catch (err: any) {
      console.warn('[HubCustomerSearch] error:', err.message);
      setState({ results: [], isLoading: false });
    }
  }, []);

  const clear = useCallback(() => setState({ results: [], isLoading: false }), []);

  return { ...state, search, clear };
}
