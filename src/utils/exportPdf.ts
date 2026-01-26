// src/utils/exportPdf.ts
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Exports a DOM element to a multi-page PDF (no cutoffs).
 * - Captures the full element height via html2canvas
 * - Slices the canvas into page-sized chunks
 * - Adds each chunk as a separate PDF page
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename = "export.pdf"
) {
  // --- Safety padding so bottom content doesn't get clipped by rounding ---
  const originalPaddingBottom = element.style.paddingBottom;
  element.style.paddingBottom = originalPaddingBottom
    ? `calc(${originalPaddingBottom} + 24px)`
    : "24px";

  // Ensure no weird overflow crops during capture
  const originalOverflow = element.style.overflow;
  element.style.overflow = "visible";

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // sharper text
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      // Helps when the element is offscreen / large
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");

    // Create PDF (Letter size)
    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "letter",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Convert canvas size to PDF units
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // We scale image to fit full PDF width
    const imgWidth = pageWidth;
    const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

    // If the content fits on one page, done.
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight, undefined, "FAST");
      pdf.save(filename);
      return;
    }

    // --- Multi-page slicing ---
    // How tall one PDF page is in canvas pixels (based on scaling ratio)
    const pageHeightInCanvasPx = Math.floor((pageHeight * canvasWidth) / pageWidth);

    let pageIndex = 0;
    let yOffsetPx = 0;

    while (yOffsetPx < canvasHeight) {
      // Create a page-sized slice canvas
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvasWidth;
      sliceCanvas.height = Math.min(pageHeightInCanvasPx, canvasHeight - yOffsetPx);

      const sliceCtx = sliceCanvas.getContext("2d");
      if (!sliceCtx) break;

      // Draw the slice from the main canvas into the slice canvas
      sliceCtx.drawImage(
        canvas,
        0,
        yOffsetPx,
        canvasWidth,
        sliceCanvas.height,
        0,
        0,
        canvasWidth,
        sliceCanvas.height
      );

      const sliceImg = sliceCanvas.toDataURL("image/png");

      if (pageIndex > 0) pdf.addPage();

      const sliceImgHeight = (sliceCanvas.height * imgWidth) / canvasWidth;

      pdf.addImage(
        sliceImg,
        "PNG",
        0,
        0,
        imgWidth,
        sliceImgHeight,
        undefined,
        "FAST"
      );

      yOffsetPx += pageHeightInCanvasPx;
      pageIndex++;
    }

    pdf.save(filename);
  } finally {
    // Restore styles
    element.style.paddingBottom = originalPaddingBottom;
    element.style.overflow = originalOverflow;
  }
}
