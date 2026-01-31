// Schafer description library - maps internal identifiers to client-facing descriptions
// Used only for matching quote items to clean proposal descriptions
const schaferDescriptions: Record<string, string> = {
  'coil 20': 'Standing Seam Metal Panels - 24ga Kynar Finish',
  'coil 48': 'Standing Seam Metal Panels - 24ga Galvanized',
  'panel fabrication': 'Panel Fabrication & Forming',
  'panel clip': 'Concealed Clip Fastening System',
  'pancake screw': 'Pancake Screw Fasteners - Galvanized/Zinc',
  'sheet 4x10': 'Standing Seam Metal Sheet - 4x10 24ga',
  'sheet 4x10 galv': 'Standing Seam Metal Sheet - 4x10 Galvanized 24ga',
  'sheet 3x10 copper': 'Standing Seam Metal Sheet - 3x10 Copper 24oz',
  'eave': 'Eave Flashing - Standing Seam Profile',
  'rake': 'Rake Edge Flashing - Standing Seam Profile',
  'rake clip': 'Rake Edge Clip Fastening',
  'ridge': 'Ridge Cap - Standing Seam Profile',
  'half ridge': 'Half Ridge Cap - Standing Seam Profile',
  'cz flashing': 'CZ Flashing - Standing Seam Profile',
  'head wall': 'Head Wall Flashing - Standing Seam Profile',
  'side wall': 'Side Wall Flashing - Standing Seam Profile',
  'starter': 'Starter Flashing - Standing Seam Profile',
  'w valley': 'Valley Flashing - Standing Seam Profile',
  'transition': 'Transition Flashing - Standing Seam Profile',
  'drip edge': 'Drip Edge Flashing - Standing Seam Profile',
  'z flash': 'Z-Flash Flashing - Standing Seam Profile',
  'parapet cap': 'Parapet Cap Flashing - Standing Seam Profile',
  'parapet cleat': 'Parapet Cleat Fastening',
  'line fabrication': 'Line Fabrication & Custom Trim',
  'panel run mile': 'Job Site Panel Run - Per Mile',
  'panel run base': 'Job Site Panel Run - Base Charge',
  'delivery fee': 'Material Delivery Fee',
  'overnight': 'Overnight Stay Charge',
  'sealant': 'Nova Seal Sealant',
  'pop rivet': 'Pop Rivet Fasteners - 1/8"',
  'pop rivet stainless': 'Pop Rivet Fasteners - 1/8" Stainless Steel',
  'woodgrip': 'Woodgrip Fasteners - 1-1/2" Galvanized',
};

// Match Schafer quote item name to client description using fuzzy matching
export const matchSchaferDescription = (quoteItemName: string): string => {
  const normalized = quoteItemName.toLowerCase();
  
  // Try exact key matches first
  for (const [key, description] of Object.entries(schaferDescriptions)) {
    if (normalized.includes(key)) {
      return description;
    }
  }
  
  // Fuzzy matching for common patterns
  if (normalized.includes('coil') && (normalized.includes('20') || normalized.includes('sccL20'))) {
    return schaferDescriptions['coil 20'];
  }
  if (normalized.includes('coil') && (normalized.includes('48') || normalized.includes('sccL48'))) {
    return schaferDescriptions['coil 48'];
  }
  if (normalized.includes('panel') && (normalized.includes('fab') || normalized.includes('fabrication'))) {
    return schaferDescriptions['panel fabrication'];
  }
  if (normalized.includes('panel') && normalized.includes('clip')) {
    return schaferDescriptions['panel clip'];
  }
  if (normalized.includes('pancake') || normalized.includes('pcscga')) {
    return schaferDescriptions['pancake screw'];
  }
  if (normalized.includes('sheet') && normalized.includes('4x10') && normalized.includes('galv')) {
    return schaferDescriptions['sheet 4x10 galv'];
  }
  if (normalized.includes('sheet') && normalized.includes('4x10')) {
    return schaferDescriptions['sheet 4x10'];
  }
  if (normalized.includes('sheet') && normalized.includes('3x10') && normalized.includes('copper')) {
    return schaferDescriptions['sheet 3x10 copper'];
  }
  if ((normalized.includes('fab-eave') || normalized.includes('fab eave')) && !normalized.includes('clip')) {
    return schaferDescriptions['eave'];
  }
  if (normalized.includes('fab-rake') && normalized.includes('clip')) {
    return schaferDescriptions['rake clip'];
  }
  if (normalized.includes('fab-rake') || normalized.includes('fab rake')) {
    return schaferDescriptions['rake'];
  }
  if (normalized.includes('fab-hiprdge') || normalized.includes('fab ridge') || normalized.includes('ridge')) {
    if (normalized.includes('half')) {
      return schaferDescriptions['half ridge'];
    }
    return schaferDescriptions['ridge'];
  }
  if (normalized.includes('fab-cz') || normalized.includes('cz flashing')) {
    return schaferDescriptions['cz flashing'];
  }
  if (normalized.includes('fab-headwall') || normalized.includes('head wall')) {
    return schaferDescriptions['head wall'];
  }
  if (normalized.includes('fab-sidewall') || normalized.includes('side wall')) {
    return schaferDescriptions['side wall'];
  }
  if (normalized.includes('fab-strtr') || normalized.includes('starter')) {
    return schaferDescriptions['starter'];
  }
  if (normalized.includes('fab-wvalley') || normalized.includes('valley')) {
    return schaferDescriptions['w valley'];
  }
  if (normalized.includes('fab-transition') || normalized.includes('transition')) {
    return schaferDescriptions['transition'];
  }
  if (normalized.includes('fab-dripedge') || normalized.includes('drip edge')) {
    return schaferDescriptions['drip edge'];
  }
  if (normalized.includes('fab-zflash') || normalized.includes('z flash')) {
    return schaferDescriptions['z flash'];
  }
  if (normalized.includes('parapet')) {
    if (normalized.includes('cleat')) {
      return schaferDescriptions['parapet cleat'];
    }
    return schaferDescriptions['parapet cap'];
  }
  if (normalized.includes('line fabrication') || normalized.includes('fabtrimscha')) {
    return schaferDescriptions['line fabrication'];
  }
  if (normalized.includes('panel run') && normalized.includes('mile')) {
    return schaferDescriptions['panel run mile'];
  }
  if (normalized.includes('panel run')) {
    return schaferDescriptions['panel run base'];
  }
  if (normalized.includes('delivery fee') || normalized.includes('delfee')) {
    return schaferDescriptions['delivery fee'];
  }
  if (normalized.includes('overnight')) {
    return schaferDescriptions['overnight'];
  }
  if (normalized.includes('nova seal') || normalized.includes('sealant')) {
    return schaferDescriptions['sealant'];
  }
  if (normalized.includes('pop rivet')) {
    if (normalized.includes('stainless')) {
      return schaferDescriptions['pop rivet stainless'];
    }
    return schaferDescriptions['pop rivet'];
  }
  if (normalized.includes('woodgrip')) {
    return schaferDescriptions['woodgrip'];
  }
  
  // If no match found, return the original quote description
  return quoteItemName;
};
