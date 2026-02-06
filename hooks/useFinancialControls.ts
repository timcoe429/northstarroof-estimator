import { useState, useEffect } from 'react';

export const useFinancialControls = () => {
  const [marginPercent, setMarginPercent] = useState(() => {
    if (typeof window === 'undefined') return 40;
    const saved = localStorage.getItem('roofscope_margin');
    return saved ? parseFloat(saved) : 40;
  });

  const [officeCostPercent, setOfficeCostPercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_office_percent');
    return saved ? parseFloat(saved) : 10;
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

  const [salesTaxPercent, setSalesTaxPercent] = useState(() => {
    if (typeof window === 'undefined') return 10;
    const saved = localStorage.getItem('roofscope_sales_tax');
    return saved ? parseFloat(saved) : 10;
  });

  // Save to localStorage when values change
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

  useEffect(() => {
    localStorage.setItem('roofscope_sales_tax', salesTaxPercent.toString());
  }, [salesTaxPercent]);

  return {
    marginPercent,
    setMarginPercent,
    officeCostPercent,
    setOfficeCostPercent,
    wastePercent,
    setWastePercent,
    sundriesPercent,
    setSundriesPercent,
    salesTaxPercent,
    setSalesTaxPercent,
  };
};
