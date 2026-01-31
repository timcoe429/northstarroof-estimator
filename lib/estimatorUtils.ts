import type { Measurements, VendorQuote } from '@/types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1]);
      } else {
        throw new Error('Failed to convert file to base64 string');
      }
    };
    reader.readAsDataURL(file);
  });
};

export const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const normalizeVendor = (value: string): VendorQuote['vendor'] => {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('schafer')) return 'schafer';
  if (normalized.includes('tra')) return 'tra';
  if (normalized.includes('rocky')) return 'rocky-mountain';
  return 'schafer';
};

export const formatVendorName = (vendor: VendorQuote['vendor']) => {
  if (vendor === 'schafer') return 'Schafer';
  if (vendor === 'tra') return 'TRA';
  return 'Rocky Mountain';
};

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const removeKeywordFromDescription = (description: string, keyword: string) => {
  if (!description) return '';
  const escaped = escapeRegExp(keyword);
  const withCommas = new RegExp(`(^|,\\s*)${escaped}(?=\\s*,|$)`, 'i');
  let updated = description;
  if (withCommas.test(updated)) {
    updated = updated.replace(withCommas, '');
  } else {
    updated = updated.replace(new RegExp(escaped, 'i'), '');
  }
  return updated
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/^,\s*/g, '')
    .replace(/\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const mergeMeasurements = (existing: Measurements, newData: Partial<Measurements>): Measurements => {
  return {
    ...existing,
    ...newData,
    // Update predominant_pitch if new data provides it
    predominant_pitch: newData.predominant_pitch !== undefined && newData.predominant_pitch !== null && newData.predominant_pitch !== ''
      ? newData.predominant_pitch
      : existing.predominant_pitch,
    // Preserve existing values unless new ones are provided (handle undefined/null)
    steep_squares: newData.steep_squares !== undefined && newData.steep_squares !== null 
      ? newData.steep_squares 
      : (existing.steep_squares ?? undefined),
    standard_squares: newData.standard_squares !== undefined && newData.standard_squares !== null 
      ? newData.standard_squares 
      : (existing.standard_squares ?? undefined),
    flat_squares: newData.flat_squares !== undefined && newData.flat_squares !== null 
      ? newData.flat_squares 
      : (existing.flat_squares ?? undefined),
  };
};
