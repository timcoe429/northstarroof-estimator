/**
 * Convert a string to title case with special handling for:
 * - Connector words (of, and, the, in, for, with)
 * - Units/abbreviations (24ga, SF, LF, SS, SA)
 * - Brand names (Kynar, Nova Seal, Sharkskin, Grace)
 * - Ampersands (&)
 */

const CONNECTOR_WORDS = new Set(['of', 'and', 'the', 'in', 'for', 'with']);
const BRAND_NAMES = new Set([
  'kynar',
  'nova seal',
  'sharkskin',
  'grace',
  'brava',
  'davinci',
  'velux',
  'osb',
  'gaf',
  'owens corning',
  'sonneborn',
  'lucas',
  'broan',
  'airhawk',
  'rocky mountain',
  'rmsg',
]);

/**
 * Convert string to title case, preserving special cases
 */
export function toTitleCase(str: string): string {
  if (!str) return str;

  // Split by spaces and process each word
  const words = str.split(/\s+/);
  
  return words
    .map((word, index) => {
      const lowerWord = word.toLowerCase();
      
      // Keep ampersands as-is
      if (word === '&') return '&';
      
      // Keep units/abbreviations (check if word contains numbers or is all caps)
      if (/^\d/.test(word) || /^[A-Z]{2,}$/.test(word)) {
        return word;
      }
      
      // Check if it's a brand name (case-insensitive)
      if (BRAND_NAMES.has(lowerWord)) {
        // Capitalize first letter, rest lowercase
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      
      // First word always capitalized
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      
      // Connector words stay lowercase (except when first word)
      if (CONNECTOR_WORDS.has(lowerWord)) {
        return lowerWord;
      }
      
      // Default: capitalize first letter, rest lowercase
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
