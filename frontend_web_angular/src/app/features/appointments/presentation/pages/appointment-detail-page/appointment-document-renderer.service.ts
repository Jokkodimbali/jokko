import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';

@Injectable({ providedIn: 'root' })
export class AppointmentDocumentRendererService {
  private readonly feedback = inject(AppFeedbackService);

  async downloadHtmlDocument(fileName: string, title: string, body: string): Promise<boolean> {
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body{font-family:var(--font-app,Inter,system-ui,sans-serif);color:#111827;margin:0;background:#f8fafc}
    .sheet{background:#fff;margin:24px auto;max-width:820px;padding:42px;border:1px solid #e5e7eb}
    @media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}}
    body.invoice-document{background:#fff}.sheet.invoice-sheet{border:0;border-radius:0;box-shadow:none;margin:0;max-width:none;min-height:1123px;overflow:visible;padding:0;width:794px}
    .sheet.prescription-sheet{border-radius:0;box-shadow:none;max-width:none;width:794px}
  </style>
</head>
<body class="${body.includes('system-invoice') || body.includes('medical-prescription') ? 'invoice-document' : ''}"><main class="sheet${body.includes('system-invoice') || body.includes('medical-prescription') ? ' invoice-sheet' : ''}${body.includes('medical-prescription') ? ' prescription-sheet' : ''}">${body}</main></body>
</html>`;
    const pdfFileName = fileName.replace(/\.html?$/i, '.pdf');
    return this.renderDesignedDocumentAsPdf(html, pdfFileName);
  }

  private async renderDesignedDocumentAsPdf(html: string, fileName: string): Promise<boolean> {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.left = '-10000px';
    frame.style.top = '0';
    frame.style.width = '794px';
    frame.style.height = '1123px';
    frame.style.border = '0';
    document.body.appendChild(frame);

    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) throw new Error('PDF frame document unavailable');

      frameDocument.open();
      frameDocument.write(html);
      frameDocument.close();
      frameDocument.documentElement.style.setProperty(
        '--font-app',
        getComputedStyle(document.body).fontFamily,
      );
      // Firefox rejects adding a FontFace owned by a stylesheet to another document.
      // The inherited family name still lets the isolated document use its available fallback.
      await document.fonts?.ready;
      await Promise.race([
        Promise.allSettled(Array.from(frameDocument.images, (image) => image.decode())),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);

      const host = frameDocument.body;
      const captureScale = Math.max(3, Math.min(4, (window.devicePixelRatio || 1) * 2));
      const contentHeight = Math.max(1123, Math.ceil(host.scrollHeight));
      frame.style.height = `${contentHeight}px`;
      const protectedRanges = this.collectProtectedPageRanges(host, captureScale);
      const canvas = await html2canvas(host, {
        backgroundColor: '#ffffff',
        scale: captureScale,
        useCORS: true,
        width: 794,
        height: contentHeight,
        windowWidth: 794,
        windowHeight: contentHeight,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true,
      });
      this.addCanvasPagesToPdf(pdf, canvas, protectedRanges);
      this.triggerPdfDownload(pdf.output('blob'), fileName);
      return true;
    } catch {
      this.feedback.error('Impossible de generer le PDF pour le moment.');
      return false;
    } finally {
      frame.remove();
    }
  }

  private triggerPdfDownload(pdf: Blob, fileName: string): void {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private addCanvasPagesToPdf(
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    protectedRanges: Array<{ top: number; bottom: number }>,
  ): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageSliceHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
    const minimumSliceHeight = Math.floor(pageSliceHeight * 0.72);
    let sourceY = 0;
    let pageIndex = 0;

    while (sourceY < canvas.height) {
      const remainingHeight = canvas.height - sourceY;
      const sliceHeight =
        remainingHeight <= pageSliceHeight
          ? remainingHeight
          : this.findSafePageSliceHeight(
              canvas,
              sourceY,
              pageSliceHeight,
              minimumSliceHeight,
              protectedRanges,
            );
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext('2d');
      if (!context) {
        throw new Error('PDF canvas context unavailable');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      if (pageIndex > 0) {
        pdf.addPage('a4', 'portrait');
      }

      const pageImage = pageCanvas.toDataURL('image/png', 1);
      const renderedHeight = (sliceHeight * pageWidth) / canvas.width;
      pdf.addImage(pageImage, 'PNG', 0, 0, pageWidth, renderedHeight, undefined, 'FAST');
      sourceY += sliceHeight;
      pageIndex += 1;
    }
  }

  private findSafePageSliceHeight(
    canvas: HTMLCanvasElement,
    sourceY: number,
    preferredHeight: number,
    minimumHeight: number,
    protectedRanges: Array<{ top: number; bottom: number }>,
  ): number {
    const context = canvas.getContext('2d');
    if (!context) return preferredHeight;

    const start = sourceY + minimumHeight;
    const end = Math.min(sourceY + preferredHeight, canvas.height - 1);
    const protectedCut = this.findProtectedRangeCut(
      sourceY,
      end,
      start,
      preferredHeight,
      protectedRanges,
    );
    if (protectedCut !== null) return protectedCut;

    const scanStep = 4;
    const blankRunNeeded = 18;
    let bestCut = end;
    let blankRun = 0;

    for (let y = end; y >= start; y -= scanStep) {
      if (this.isMostlyBlankCanvasRow(context, canvas.width, y)) {
        blankRun += scanStep;
        if (blankRun >= blankRunNeeded) {
          bestCut = y + blankRun;
          break;
        }
      } else {
        blankRun = 0;
      }
    }

    return Math.max(minimumHeight, Math.min(preferredHeight, bestCut - sourceY));
  }

  private collectProtectedPageRanges(
    host: HTMLElement,
    captureScale: number,
  ): Array<{ top: number; bottom: number }> {
    const hostRect = host.getBoundingClientRect();
    const protectedSelectors = [
      '.custom-prescription__item',
      '.custom-prescription__signatures',
      '.custom-prescription__footer',
      '.invoice-header',
      '.invoice-parties',
      '.invoice-location',
      '.invoice-row',
      '.invoice-summary',
      '.invoice-auth',
      '.invoice-footer',
    ].join(',');

    return Array.from(host.querySelectorAll<HTMLElement>(protectedSelectors))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: Math.floor((rect.top - hostRect.top) * captureScale),
          bottom: Math.ceil((rect.bottom - hostRect.top) * captureScale),
        };
      })
      .filter((range) => range.bottom > range.top)
      .sort((first, second) => first.top - second.top);
  }

  private findProtectedRangeCut(
    sourceY: number,
    cutY: number,
    minimumCutY: number,
    preferredHeight: number,
    protectedRanges: Array<{ top: number; bottom: number }>,
  ): number | null {
    const pageMargin = 16;
    for (const range of protectedRanges) {
      if (cutY <= range.top || cutY >= range.bottom) continue;

      const beforeRangeCut = range.top - pageMargin;
      if (beforeRangeCut >= minimumCutY) {
        return Math.max(1, beforeRangeCut - sourceY);
      }

      const rangeHeight = range.bottom - range.top;
      if (rangeHeight < preferredHeight * 0.82 && range.bottom - sourceY <= preferredHeight) {
        return Math.max(1, Math.min(preferredHeight, range.bottom - sourceY + pageMargin));
      }
    }

    return null;
  }

  private isMostlyBlankCanvasRow(
    context: CanvasRenderingContext2D,
    width: number,
    y: number,
  ): boolean {
    const sample = context.getImageData(0, y, width, 1).data;
    let nonWhitePixels = 0;

    for (let index = 0; index < sample.length; index += 16) {
      const red = sample[index] ?? 255;
      const green = sample[index + 1] ?? 255;
      const blue = sample[index + 2] ?? 255;
      const alpha = sample[index + 3] ?? 255;
      if (alpha > 10 && (red < 246 || green < 246 || blue < 246)) {
        nonWhitePixels += 1;
      }
      if (nonWhitePixels > 8) return false;
    }

    return true;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
