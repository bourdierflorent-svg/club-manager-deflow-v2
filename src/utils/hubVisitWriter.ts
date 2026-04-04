interface VisitItem {
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

interface VisitParams {
  customerId: string;
  eventId: string;
  clientId: string;
  amount: number;
  items?: VisitItem[];
}

/**
 * Stub -- visits table not yet available in Supabase.
 * Logs to console and returns immediately.
 */
export async function writeVisitToHub(params: VisitParams): Promise<void> {
  console.log('[hubVisitWriter] stub -- no visits table in Supabase yet', params);
}
