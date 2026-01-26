import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPdf(
  element: HTMLElement,
  filename = "export.pdf"
) {
  // Force overflow visible + extra padding to reduce clipping
  const prevOverflow = element.style.overflow;
  const prevPaddingBottom = element.style.paddingBottom;

  element.style.overflow = "visible";
  element.style.paddingBottom = prevPaddingBottom
    ? `calc(${prevPaddingBottom} + 40px)`
    : "40px";

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "p",
      unit: "pt",
      format: "letter",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Image dimensions in PDF
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Multi-page logic
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

    heightLeft -= pageHeight;

    while (heightLeft > 1) {
      pdf.addPage();
      position = heightLeft - imgHeight; // negative moves image up
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    element.style.overflow = prevOverflow;
    element.style.paddingBottom = prevPaddingBottom;
  }
}
