import { supabase } from '../../supabaseConfig';
import { HubCustomerSnapshot } from '../types';

interface CreateHubCustomerParams {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  createdByName?: string | null;
}

interface CreateHubCustomerResult {
  customerId: string;
  snapshot: HubCustomerSnapshot;
}

/**
 * Auto-create a Hub customer from basic info (name, optional nickname/phone).
 * Returns the new customer ID and a snapshot to store on the club-side document.
 */
export async function createHubCustomerAuto(
  params: CreateHubCustomerParams
): Promise<CreateHubCustomerResult> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const displayName = `${firstName} ${lastName}`;
  const nickname = params.nickname?.trim() || null;

  const { data: inserted, error } = await supabase
    .from('customers')
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone: params.phone?.trim() || null,
      email: null,
      tags: [],
      total_revenue: 0,
      vip_score: 0,
    })
    .select('id')
    .single();

  if (error || !inserted) throw new Error(error?.message || 'Insert failed');

  return {
    customerId: inserted.id,
    snapshot: {
      customerId: inserted.id,
      displayName,
      nickname,
      tags: [],
      vipScore: 0,
    },
  };
}
