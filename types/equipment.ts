export type EquipmentRuleType = 'per-job' | 'per-60-squares';

export interface EquipmentRule {
  itemName: string; // Must match price_items.name EXACTLY
  ruleType: EquipmentRuleType;
  defaultQty: number;
}

// Item names verified against price_items table on 2/18/2026
export const EQUIPMENT_RULES: EquipmentRule[] = [
  { itemName: 'Porto Potty', ruleType: 'per-job', defaultQty: 1 },
  { itemName: 'Fuel Charge', ruleType: 'per-job', defaultQty: 1 },
  { itemName: 'Overnight Charge', ruleType: 'per-job', defaultQty: 1 },
  { itemName: 'Brava Delivery', ruleType: 'per-job', defaultQty: 1 },
  { itemName: 'Landfill Charge', ruleType: 'per-60-squares', defaultQty: 1 },
  { itemName: 'Aspen Reprographic', ruleType: 'per-job', defaultQty: 1 },
];
