import { useState, useEffect, useMemo } from 'react';

export function useFinancialSettings() {
  // Financial controls
  const [marginPercent, setMarginPercent] = useState(() => {
    if (typeof window === 'undefined') return 20;
    const saved = localStorage.getItem('roofscope_margin');
    return saved ? parseFloat(saved) : 20;
  });
  const [officeCostPercent, setOfficeCostPercent] = useState(() => {
    if (typeof window === 'undefined') return 5;
    const saved = localStorage.getItem('roofscope_office_percent');
    return saved ? parseFloat(saved) : 5;
  });
  const [wastePercent, setWastePercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_waste');
    return saved ? parseFloat(saved) : 10;
  });
  const [sundriesPercent, setSundriesPercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_sundries');
    return saved ? parseFloat(saved) : 10;
  });
  const [showFinancials, setShowFinancials] = useState(false);

  // Save financial settings to localStorage
  useEffect(() => {
    localStorage.setItem('roofscope_margin', marginPercent.toString());
  }, [marginPercent]);

  useEffect(() => {
    localStorage.setItem('roofscope_office_percent', officeCostPercent.toString());
  }, [officeCostPercent]);

  useEffect(() => {
    localStorage.setItem('roofscope_waste', wastePercent.toString());
  }, [wastePercent]);

  useEffect(() => {
    localStorage.setItem('roofscope_sundries', sundriesPercent.toString());
  }, [sundriesPercent]);

  // Calculate markup multiplier for client view
  // Combined multiplier = (1 + officePercent/100) × (1 + marginPercent/100)
  const markupMultiplier = useMemo(() => {
    return (1 + officeCostPercent / 100) * (1 + marginPercent / 100);
  }, [officeCostPercent, marginPercent]);

  return {
    marginPercent,
    setMarginPercent,
    officeCostPercent,
    setOfficeCostPercent,
    wastePercent,
    setWastePercent,
    sundriesPercent,
    setSundriesPercent,
    showFinancials,
    setShowFinancials,
    markupMultiplier,
  };
}
