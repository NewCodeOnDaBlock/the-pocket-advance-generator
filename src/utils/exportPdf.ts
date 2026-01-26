import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Export a DOM element to a multi-page PDF.
 * - Uses html2canvas to render to a canvas
 * - Slices the canvas into pages and adds them to jsPDF
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename = "export.pdf"
) {
  // Render DOM to canvas (high res)
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");

  // Letter size in points (8.5 x 11 inches)
  const pdf = new jsPDF({
    orientation: "p",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Fit image to PDF width
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If it's only one page, easy path
  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save(filename);
    return;
  }

  let remainingHeight = imgHeight;
  let y = 0;

  while (remainingHeight > 0) {
    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);

    remainingHeight -= pageHeight;
    y -= pageHeight;

    if (remainingHeight > 0) {
      pdf.addPage();
    }
  }

  pdf.save(filename);
}
