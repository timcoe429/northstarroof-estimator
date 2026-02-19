import type { LineItem, GroupedLineItem } from '@/types';
import { formatCurrency } from './estimatorUtils';

// Items that should NEVER be grouped
const isStandaloneItem = (item: LineItem): boolean => {
  // Price threshold - check base cost, not marked-up client price
  const baseCost = (item as any).baseCost || item.total;
  if (baseCost > 1500) return true;
  
  const nameLower = item.name.toLowerCase();
  
  // Primary roofing materials
  if (nameLower.includes('brava field') || nameLower.includes('brava starter') ||
      nameLower.includes('brava h&r') || nameLower.includes('brava solids') ||
      nameLower.includes('davinci') || nameLower.includes('field tile') ||
      nameLower.includes('shake')) return true;
  
  // Underlayment
  if (nameLower.includes('oc titanium') || nameLower.includes('psu 30') ||
      nameLower.includes('solarhide') || nameLower.includes('versashield')) return true;
  
  // Labor, equipment, optional - always standalone
  if (item.category === 'labor' || item.category === 'equipment') return true;
  if (item.isOptional) return true;
  
  return false;
};

// Kit matching functions
const isAluminumFlashing = (name: string): boolean => {
  const n = name.toLowerCase();
  if (n.includes('copper')) return false; // Exclude copper
  return n.includes('d-style') || n.includes('valley') || n.includes('step flash') ||
         n.includes('headwall') || n.includes('pitch change') || 
         n.includes('hip & ridge') || n.includes('flat sheet');
};

const isCopperFlashing = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.includes('copper') && (n.includes('d-style') || n.includes('valley') || 
         n.includes('step flash') || n.includes('headwall') || n.includes('pitch change') ||
         n.includes('flat sheet'));
};

const isFastener = (name: string): boolean => {
  const n = name.toLowerCase();
  return n.includes('coil nail') || n.includes('screw') || n.includes('plasticap') ||
         n.includes('fastener');
};

// Flashing items for Custom Flashing Kit (eave, rake, valley, step, hip, ridge)
const isFlashingForCustomKit = (name: string): boolean => {
  const n = name.toLowerCase();
  return ['eave', 'rake', 'valley', 'step', 'hip', 'ridge', 'd-style', 'headwall', 'pitch change', 'flat sheet'].some(
    (kw) => n.includes(kw)
  );
};

export const groupItemsIntoKits = (items: LineItem[]): GroupedLineItem[] => {
  // Kit grouping disabled — all items show as individual line items
  return items.map(item => ({ ...item, isKit: false }));
};
