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

const COMPLEXITY_RANK: Record<string, number> = {
  Simple: 1,
  Moderate: 2,
  Complex: 3,
};

const higherComplexity = (a: string, b: string): string => {
  const rankA = COMPLEXITY_RANK[a] ?? 0;
  const rankB = COMPLEXITY_RANK[b] ?? 0;
  return rankA >= rankB ? a || b : b || a;
};

export const mergeMeasurements = (existing: Measurements, newData: Partial<Measurements>): Measurements => {
  const sum = (a: number | null | undefined, b: number | null | undefined) =>
    (a ?? 0) + (b ?? 0);

  return {
    total_squares: sum(existing.total_squares, newData.total_squares),
    ridge_length: sum(existing.ridge_length, newData.ridge_length),
    hip_length: sum(existing.hip_length, newData.hip_length),
    valley_length: sum(existing.valley_length, newData.valley_length),
    eave_length: sum(existing.eave_length, newData.eave_length),
    rake_length: sum(existing.rake_length, newData.rake_length),
    penetrations: sum(existing.penetrations, newData.penetrations),
    skylights: sum(existing.skylights, newData.skylights),
    chimneys: sum(existing.chimneys, newData.chimneys),
    predominant_pitch:
      newData.predominant_pitch !== undefined &&
      newData.predominant_pitch !== null &&
      newData.predominant_pitch !== ''
        ? newData.predominant_pitch
        : existing.predominant_pitch,
    complexity: higherComplexity(existing.complexity ?? '', newData.complexity ?? ''),
    steep_squares: sum(existing.steep_squares, newData.steep_squares),
    standard_squares: sum(existing.standard_squares, newData.standard_squares),
    flat_squares: sum(existing.flat_squares, newData.flat_squares),
    fileName:
      existing.fileName && newData.fileName
        ? `${existing.fileName} + ${newData.fileName}`
        : (newData.fileName ?? existing.fileName),
  };
};

export const resetMeasurements = (): Measurements => ({
  total_squares: 0,
  predominant_pitch: '',
  ridge_length: 0,
  hip_length: 0,
  valley_length: 0,
  eave_length: 0,
  rake_length: 0,
  penetrations: 0,
  skylights: 0,
  chimneys: 0,
  complexity: '',
  steep_squares: 0,
  standard_squares: 0,
  flat_squares: 0,
});
