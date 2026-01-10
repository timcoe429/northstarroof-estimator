import { createClient } from '@supabase/supabase-js';
import type { SavedQuote, Estimate, Measurements, LineItem, CustomerInfo } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Create client (will fail gracefully at runtime if env vars not set)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate a simple UUID-like string for user ID
function generateUserId(): string {
  return 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// Get or create user ID from localStorage
export function getUserId(): string {
  if (typeof window === 'undefined') {
    return generateUserId();
  }
  
  const stored = localStorage.getItem('roofscope_user_id');
  if (stored) {
    return stored;
  }
  
  const userId = generateUserId();
  localStorage.setItem('roofscope_user_id', userId);
  return userId;
}

// Save quote to Supabase
export async function saveQuote(estimate: Estimate, quoteName: string): Promise<SavedQuote> {
  const userId = getUserId();
  
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

  const { data, error } = await supabase
    .from('estimates')
    .insert(quoteData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save quote: ${error.message}`);
  }

  return data as SavedQuote;
}

// Load all quotes for current user
export async function loadQuotes(): Promise<SavedQuote[]> {
  const userId = getUserId();
  
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load quotes: ${error.message}`);
  }

  return (data || []) as SavedQuote[];
}

// Load single quote by ID
export async function loadQuote(id: string): Promise<SavedQuote> {
  const userId = getUserId();
  
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to load quote: ${error.message}`);
  }

  return data as SavedQuote;
}

// Delete quote by ID
export async function deleteQuote(id: string): Promise<void> {
  const userId = getUserId();
  
  const { error } = await supabase
    .from('estimates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete quote: ${error.message}`);
  }
}

// Update existing quote
export async function updateQuote(id: string, estimate: Estimate, quoteName: string): Promise<SavedQuote> {
  const userId = getUserId();
  
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
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update quote: ${error.message}`);
  }

  return data as SavedQuote;
}
