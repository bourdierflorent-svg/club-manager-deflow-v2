import { useState, useCallback } from 'react';
import { supabase } from '../../supabaseConfig';
import { HubApporteur } from '../types';

interface SearchState {
  results: HubApporteur[];
  isLoading: boolean;
}

export function useHubApporteurSearch() {
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
        .from('apporteurs')
        .select('*')
        .or(`name.ilike.${pattern},id.ilike.${pattern}`)
        .limit(8);

      if (error) {
        console.warn('[HubApporteurSearch] error:', error.message);
        setState({ results: [], isLoading: false });
        return;
      }

      const results: HubApporteur[] = (data ?? []).map(row => ({
        id: row.id,
        name: row.name ?? '',
        displayNameSearch: (row.name ?? '').toLowerCase(),
        phone: row.phone ?? null,
        email: row.email ?? null,
      }));

      setState({ results, isLoading: false });
    } catch (err: any) {
      console.warn('[HubApporteurSearch] error:', err.message);
      setState({ results: [], isLoading: false });
    }
  }, []);

  const clear = useCallback(() => setState({ results: [], isLoading: false }), []);

  return { ...state, search, clear };
}
