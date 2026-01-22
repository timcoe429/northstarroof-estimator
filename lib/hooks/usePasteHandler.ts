import { useEffect } from 'react';
import type { Measurements } from '@/types';

type UsePasteHandlerParams = {
  showPrices: boolean;
  step: string;
  measurements: Measurements | null;
  uploadedImages: Set<string>;
  extractFromImage: (file: File) => Promise<void>;
  extractPricesFromImage: (file: File) => Promise<void>;
};

export function usePasteHandler(params: UsePasteHandlerParams) {
  const {
    showPrices,
    step,
    measurements,
    uploadedImages,
    extractFromImage,
    extractPricesFromImage,
  } = params;

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const itemsArray = Array.from(items);
      for (const item of itemsArray) {
        if (item.type === 'application/pdf') {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          if (step === 'upload' || step === 'extracted') {
            extractFromImage(file);
          }
          break;
        }

        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          if (showPrices) {
            extractPricesFromImage(file);
          } else if (step === 'upload' || step === 'extracted') {
            // Allow pasting in 'extracted' step to add analysis image
            extractFromImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showPrices, step, measurements, uploadedImages, extractFromImage, extractPricesFromImage]);
}
