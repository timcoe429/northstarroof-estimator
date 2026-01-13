import { createClient } from '@supabase/supabase-js';
import type { SavedQuote, Estimate, Measurements, LineItem, CustomerInfo, PriceItem } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create client (will fail gracefully at runtime if env vars not set)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Save quote to Supabase
export async function saveQuote(estimate: Estimate, quoteName: string, userId: string | undefined): Promise<SavedQuote> {
  // Debug logging
  console.log('saveQuote received userId:', userId);
  console.log('saveQuote userId type:', typeof userId);
  console.log('saveQuote userId format check:', userId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) : 'undefined');
  
  if (!userId) {
    throw new Error('User ID is required to save quote');
  }
  
  const quoteData = {
    user_id: userId,
    customer_id: null, // Will link customers later
    name: quoteName,
    measurements: estimate.measurements,
    line_items: estimate.lineItems,
    base_cost: estimate.baseCost,
    office_percent: estimate.officeCostPercent,
    office_amount: estimate.officeAllocation,
    margin_percent: estimate.marginPercent,
    total_cost: estimate.totalCost,
    sell_price: estimate.sellPrice,
    gross_profit: estimate.grossProfit,
    status: 'draft',
  };

  // Debug logging - log quoteData before insert
  console.log('saveQuote quoteData:', quoteData);
  console.log('saveQuote user_id value:', quoteData.user_id);
  
  const { data, error } = await supabase
    .from('estimates')
    .insert(quoteData)
    .select()
    .single();

  if (error) {
    console.error('saveQuote error:', error);
    console.error('saveQuote error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to save quote: ${error.message}`);
  }
  
  console.log('saveQuote success, saved data:', data);

  return data as SavedQuote;
}

// Load all quotes (all users can see all quotes)
export async function loadQuotes(userId: string | undefined): Promise<SavedQuote[]> {
  if (!userId) {
    throw new Error('User ID is required to load quotes');
  }
  
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load quotes: ${error.message}`);
  }

  return (data || []) as SavedQuote[];
}

// Load single quote by ID
export async function loadQuote(id: string, userId: string | undefined): Promise<SavedQuote> {
  if (!userId) {
    throw new Error('User ID is required to load quote');
  }
  
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to load quote: ${error.message}`);
  }

  return data as SavedQuote;
}

// Delete quote by ID
export async function deleteQuote(id: string, userId: string | undefined): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to delete quote');
  }
  
  const { error } = await supabase
    .from('estimates')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete quote: ${error.message}`);
  }
}

// Update existing quote
export async function updateQuote(id: string, estimate: Estimate, quoteName: string, userId: string | undefined): Promise<SavedQuote> {
  if (!userId) {
    throw new Error('User ID is required to update quote');
  }
  
  const quoteData = {
    name: quoteName,
    measurements: estimate.measurements,
    line_items: estimate.lineItems,
    base_cost: estimate.baseCost,
    office_percent: estimate.officeCostPercent,
    office_amount: estimate.officeAllocation,
    margin_percent: estimate.marginPercent,
    total_cost: estimate.totalCost,
    sell_price: estimate.sellPrice,
    gross_profit: estimate.grossProfit,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('estimates')
    .update(quoteData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update quote: ${error.message}`);
  }

  return data as SavedQuote;
}

// Load all price items for a user
export async function loadPriceItems(userId: string): Promise<PriceItem[]> {
  if (!userId) {
    throw new Error('User ID is required to load price items');
  }
  
  const { data, error } = await supabase
    .from('price_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load price items: ${error.message}`);
  }

  // Transform from database format (snake_case) to app format (camelCase)
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    price: item.price,
    coverage: item.coverage,
    coverageUnit: item.coverage_unit || null,
    category: item.category as PriceItem['category'],
    proposalDescription: item.proposal_description || null,
  }));
}

// Save (upsert) a single price item
export async function savePriceItem(item: PriceItem, userId: string): Promise<PriceItem> {
  if (!userId) {
    throw new Error('User ID is required to save price item');
  }
  
  // Transform from app format (camelCase) to database format (snake_case)
  const dbItem = {
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    unit: item.unit,
    price: item.price,
    coverage: item.coverage,
    coverage_unit: item.coverageUnit || null,
    proposal_description: item.proposalDescription || null,
  };

  const { data, error } = await supabase
    .from('price_items')
    .upsert(dbItem, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save price item: ${error.message}`);
  }

  // Transform back to app format
  return {
    id: data.id,
    name: data.name,
    unit: data.unit,
    price: data.price,
    coverage: data.coverage,
    coverageUnit: data.coverage_unit || null,
    category: data.category as PriceItem['category'],
    proposalDescription: data.proposal_description || null,
  };
}

// Bulk save (upsert) multiple price items
export async function savePriceItemsBulk(items: PriceItem[], userId: string): Promise<PriceItem[]> {
  if (!userId) {
    throw new Error('User ID is required to save price items');
  }
  
  // Transform all items from app format to database format
  const dbItems = items.map(item => ({
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    unit: item.unit,
    price: item.price,
    coverage: item.coverage,
    coverage_unit: item.coverageUnit || null,
    proposal_description: item.proposalDescription || null,
  }));

  const { data, error } = await supabase
    .from('price_items')
    .upsert(dbItems, { onConflict: 'id' })
    .select();

  if (error) {
    throw new Error(`Failed to save price items: ${error.message}`);
  }

  // Transform back to app format
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    price: item.price,
    coverage: item.coverage,
    coverageUnit: item.coverage_unit || null,
    category: item.category as PriceItem['category'],
    proposalDescription: item.proposal_description || null,
  }));
}

// Delete a price item from database
export async function deletePriceItemFromDB(itemId: string, userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to delete price item');
  }
  
  const { error } = await supabase
    .from('price_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete price item: ${error.message}`);
  }
}
