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

export const groupItemsIntoKits = (items: LineItem[]): GroupedLineItem[] => {
  const standalone: LineItem[] = [];
  const aluminumFlashing: LineItem[] = [];
  const copperFlashing: LineItem[] = [];
  const fasteners: LineItem[] = [];
  
  // Sort items into categories
  items.forEach(item => {
    if (isStandaloneItem(item)) {
      standalone.push(item);
    } else if (isCopperFlashing(item.name)) {
      copperFlashing.push(item);
    } else if (isAluminumFlashing(item.name)) {
      aluminumFlashing.push(item);
    } else if (isFastener(item.name)) {
      fasteners.push(item);
    } else {
      // Items that don't match any kit stay standalone
      standalone.push(item);
    }
  });
  
  const grouped: GroupedLineItem[] = [];
  
  // Add standalone items
  standalone.forEach(item => {
    grouped.push({ ...item, isKit: false });
  });
  
  // Add Aluminum Flashing Kit
  if (aluminumFlashing.length > 0) {
    const totalPrice = aluminumFlashing.reduce((sum, item) => sum + item.total, 0);
    const subtitle = `Includes: ${aluminumFlashing.map(item => 
      `${item.name} (${formatCurrency(item.total)})`
    ).join(', ')}`;
    
    grouped.push({
      ...aluminumFlashing[0],
      name: 'Custom Fabricated Aluminum Flashing — Eave, Rake, Valley & Step pieces',
      total: totalPrice,
      isKit: true,
      subtitle,
      kitItems: aluminumFlashing,
    });
  }
  
  // Add Copper Flashing Kit
  if (copperFlashing.length > 0) {
    const totalPrice = copperFlashing.reduce((sum, item) => sum + item.total, 0);
    const subtitle = `Includes: ${copperFlashing.map(item => 
      `${item.name} (${formatCurrency(item.total)})`
    ).join(', ')}`;
    
    grouped.push({
      ...copperFlashing[0],
      name: 'Custom Fabricated Copper Flashing — Eave, Rake, Valley & Step pieces',
      total: totalPrice,
      isKit: true,
      subtitle,
      kitItems: copperFlashing,
    });
  }
  
  // Add Fasteners Kit
  if (fasteners.length > 0) {
    const totalPrice = fasteners.reduce((sum, item) => sum + item.total, 0);
    const subtitle = `Includes: ${fasteners.map(item => 
      `${item.name} (${formatCurrency(item.total)})`
    ).join(', ')}`;
    
    grouped.push({
      ...fasteners[0],
      name: 'Fasteners & Hardware Kit',
      total: totalPrice,
      isKit: true,
      subtitle,
      kitItems: fasteners,
    });
  }
  
  return grouped;
};
