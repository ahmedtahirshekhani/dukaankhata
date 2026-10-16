// src/lib/report-pdf-generator.ts

export interface ExportReportPdfOptions {
  element: HTMLElement;
  filename: string;
  watermarkText?: string;
  pageText?: (currentPage: number, totalPages: number) => string;
}

/**
 * Standard utility to generate and download branded A4 Landscape PDF reports using html2pdf.js
 */
export async function exportReportToPdf({
  element,
  filename,
  watermarkText,
  pageText,
}: ExportReportPdfOptions): Promise<void> {
  const mod = await import("html2pdf.js");
  const html2pdf = (mod as any).default || mod;

  await html2pdf()
    .set({
      margin: [6, 6, 16, 6],
      filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "landscape",
      },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".pdf-avoid-break"] },
    })
    .from(element)
    .toPdf()
    .get("pdf")
    .then((pdf: any) => {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);

        const footerText = pageText
          ? pageText(i, totalPages)
          : `Page ${i} of ${totalPages}`;

        // A4 Landscape is 297mm x 210mm
        pdf.text(footerText, 297 - 15, 210 - 5, { align: "right" });

        if (watermarkText) {
          pdf.text(watermarkText, 297 / 2, 210 - 5, { align: "center" });
        }
      }
    })
    .save();
}
