import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");

  // US Letter: 612 x 792 pt
  const pdf = new jsPDF("p", "pt", "letter");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Fit vertically if too tall
  let renderWidth = imgWidth;
  let renderHeight = imgHeight;

  if (renderHeight > pageHeight) {
    renderHeight = pageHeight;
    renderWidth = (canvas.width * renderHeight) / canvas.height;
  }

  const x = (pageWidth - renderWidth) / 2;
  const y = (pageHeight - renderHeight) / 2;

  pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
  pdf.save(filename);
}
