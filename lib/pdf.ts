import { type PDFFont, PDFDocument, StandardFonts } from "pdf-lib";

export interface ReportSection {
  heading: string;
  content: string;
}

export interface ReportData {
  title: string;
  sections: ReportSection[];
  references: string[];
  generatedAt: Date;
  threadTitle: string;
}

const MARGIN = 50;

// pdf-lib doesn't wrap text or paginate — both handled by hand here.
export async function generateReportPdf(data: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  function ensureSpace(lineHeight: number) {
    if (y < MARGIN + lineHeight) {
      page = pdfDoc.addPage();
      y = height - MARGIN;
    }
  }

  function drawWrapped(
    text: string,
    opts: { font: PDFFont; size: number; lineHeight: number },
  ) {
    const maxWidth = width - MARGIN * 2;
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (
        line &&
        opts.font.widthOfTextAtSize(candidate, opts.size) > maxWidth
      ) {
        ensureSpace(opts.lineHeight);
        page.drawText(line, { x: MARGIN, y, size: opts.size, font: opts.font });
        y -= opts.lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) {
      ensureSpace(opts.lineHeight);
      page.drawText(line, { x: MARGIN, y, size: opts.size, font: opts.font });
      y -= opts.lineHeight;
    }
  }

  drawWrapped(data.title, { font: boldFont, size: 20, lineHeight: 26 });
  y -= 8;

  drawWrapped(`Conversation: ${data.threadTitle}`, {
    font,
    size: 10,
    lineHeight: 14,
  });
  drawWrapped(`Generated: ${data.generatedAt.toISOString()}`, {
    font,
    size: 10,
    lineHeight: 14,
  });
  y -= 16;

  for (const section of data.sections) {
    ensureSpace(30);
    drawWrapped(section.heading, { font: boldFont, size: 14, lineHeight: 20 });
    drawWrapped(section.content, { font, size: 11, lineHeight: 16 });
    y -= 12;
  }

  if (data.references.length > 0) {
    ensureSpace(30);
    drawWrapped("References", { font: boldFont, size: 14, lineHeight: 20 });
    for (const ref of data.references) {
      drawWrapped(`• ${ref}`, { font, size: 10, lineHeight: 14 });
    }
  }

  return pdfDoc.save();
}
