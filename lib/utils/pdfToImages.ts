/**
 * Converts a PDF file to an array of base64 PNG data URLs.
 * Client-only utility for RoofScope PDF upload support.
 * Use dynamic import to avoid SSR issues.
 */

export async function convertPdfToImages(file: File): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const pagesToRender = Math.min(numPages, 10);
  const images: string[] = [];

  for (let i = 1; i <= pagesToRender; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get canvas context");
    }
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;
    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}
