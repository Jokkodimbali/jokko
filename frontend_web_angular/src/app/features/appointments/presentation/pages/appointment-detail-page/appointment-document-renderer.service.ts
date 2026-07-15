import { Injectable, inject } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';

@Injectable({ providedIn: 'root' })
export class AppointmentDocumentRendererService {
  private readonly feedback = inject(AppFeedbackService);

  downloadHtmlDocument(fileName: string, title: string, body: string): void {
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
    body{font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#111827;margin:0;background:#f8fafc}
    .sheet{background:#fff;margin:24px auto;max-width:820px;padding:42px;border:1px solid #e5e7eb}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111827;padding-bottom:22px;margin-bottom:28px}
    h1{font-size:24px;margin:0 0 8px;text-transform:uppercase}
    h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#865221;border-bottom:1px solid #eadccd;padding-bottom:8px;margin:28px 0 14px}
    p{margin:4px 0;line-height:1.5}.muted{color:#667085}.box{background:#f9fafb;border:1px solid #eef0f3;border-radius:12px;padding:16px}
    table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;color:#667085;border-bottom:1px solid #e5e7eb;padding:10px 8px}td{border-bottom:1px solid #f0f2f4;padding:10px 8px}.right{text-align:right}.total{font-size:18px;font-weight:800;color:#865221}
    .brand{display:inline-flex;align-items:center;gap:10px;color:#865221;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.pill{display:inline-block;border-radius:999px;background:#ecfdf3;color:#067647;font-size:12px;font-weight:800;padding:6px 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.invoice-total{background:#111827;color:#fff;border-radius:14px;padding:18px 22px;text-align:right}.invoice-total .total{color:#fff;font-size:24px}.footer-note{border-top:1px solid #e5e7eb;margin-top:28px;padding-top:18px;font-size:12px;color:#667085}
    ol,ul{padding-left:22px}li{margin:8px 0;line-height:1.45}.signature{display:flex;justify-content:space-between;gap:24px;margin-top:54px}.stamp{border:1px solid #eadccd;border-radius:12px;background:#fff8f1;color:#865221;padding:18px 24px;text-align:center;font-weight:800}
    @media(max-width:720px){.top,.grid,.signature{display:block}.right{text-align:left}.invoice-total{text-align:left}}
    @media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}}
    body.invoice-document{background:#fff}.sheet.invoice-sheet{border:0;border-radius:0;box-shadow:none;margin:0;max-width:none;min-height:1123px;overflow:hidden;padding:0;width:794px}
    .sheet.prescription-sheet{border-radius:0;box-shadow:none;max-width:none;width:794px}
    .mission-invoice{background:#fff;color:#151b29;display:flex;flex-direction:column;min-height:1123px}.mission-invoice__header{align-items:center;background:#9b6429;color:#fff;display:grid;grid-template-columns:1fr auto;gap:24px;padding:30px 38px}
    .mission-invoice__brand{align-items:center;display:flex;gap:16px}.mission-invoice__brand img{background:#fff;border-radius:12px;box-shadow:0 0 0 4px rgba(255,255,255,.18);height:52px;object-fit:contain;padding:6px;width:52px}.mission-invoice__brand h1{color:#fff;font-size:23px;letter-spacing:.02em;margin:0;text-transform:uppercase}
    .mission-invoice__meta{text-align:right}.mission-invoice__meta span{color:#ead9c6;display:block;font-size:13px;letter-spacing:.16em;margin-bottom:6px;text-transform:uppercase}.mission-invoice__meta strong{display:block;font-size:17px;margin-bottom:4px}.mission-invoice__meta small{color:#ead9c6;font-size:14px}
    .mission-invoice__parties{border-bottom:1px solid #eadccd;display:grid;grid-template-columns:1fr 1fr}.mission-invoice__party{padding:28px 36px}.mission-invoice__party + .mission-invoice__party{border-left:1px solid #eadccd}.mission-invoice__party small,.mission-invoice__table-head span{color:#9b6429;font-size:13px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.mission-invoice__party strong{display:block;font-size:19px;margin:16px 0 8px}.mission-invoice__party p{color:#6b7280;font-size:16px;margin:4px 0}
    .mission-invoice__body{flex:1;padding:22px 38px 0}.mission-invoice__notice{align-items:start;background:#f6ecdd;border:1px solid #dbb98f;border-radius:14px;color:#43515d;display:grid;gap:14px;grid-template-columns:30px 1fr;line-height:1.45;margin-bottom:20px;padding:18px 22px}.mission-invoice__notice b{color:#8a5522;display:block;font-size:16px;margin-bottom:4px}.mission-invoice__pin{align-items:center;color:#9b6429;display:inline-flex;height:26px;justify-content:center;width:26px}.mission-invoice__pin svg{display:block;height:25px;stroke:currentColor;width:25px}
    .mission-invoice__table-head{background:#f3eadc;border-radius:12px;display:grid;grid-template-columns:1fr 130px 150px;margin-bottom:8px;padding:11px 18px}.mission-invoice__row{border-bottom:1px solid #eadccd;display:grid;grid-template-columns:1fr 130px 150px;padding:18px}.mission-invoice__row strong{font-size:16px}.mission-invoice__row span,.mission-invoice__summary span{color:#5f6b7a}.mission-invoice__row .right,.mission-invoice__table-head .right{text-align:right}
    .mission-invoice__summary{display:grid;gap:10px;justify-content:end;margin:24px 0 34px}.mission-invoice__summary-line{display:grid;gap:18px;grid-template-columns:150px 130px;text-align:right}.mission-invoice__commission{color:#8a5522}.mission-invoice__total{align-items:center;background:#9b6429;border-radius:13px;color:#fff;display:grid;font-size:18px;font-weight:900;gap:18px;grid-template-columns:1fr auto;min-width:290px;padding:16px 18px}.mission-invoice__total span,.mission-invoice__total strong{color:#fff}.mission-invoice__total strong{font-size:20px}
    .mission-invoice__footer{align-items:center;background:#f7efe4;border-top:1px solid #dbb98f;color:#8b95a5;display:flex;font-size:14px;justify-content:space-between;padding:22px 36px}.mission-invoice__footer b{color:#9b6429}
    .medical-prescription{background:#fff;border-top:5px solid #9b6429;color:#151b29;min-height:1123px;position:relative}.medical-prescription__header{align-items:start;display:grid;grid-template-columns:1fr auto;gap:32px;padding:34px 44px 24px}.medical-prescription__doctor small,.medical-prescription__patient small,.medical-prescription__section-title{color:#9b6429;display:block;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.medical-prescription__doctor h1{color:#111827;font-size:23px;line-height:1.1;margin:10px 0 8px;text-transform:none}.medical-prescription__doctor p,.medical-prescription__meta small,.medical-prescription__patient span,.medical-prescription__patient em{color:#728096;font-size:14px;line-height:1.35;margin:3px 0}.medical-prescription__meta{text-align:right}.medical-prescription__meta span{color:#9aa5b5;display:block;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.medical-prescription__meta strong{color:#445066;display:block;font-size:12px;margin:6px 0}.medical-prescription__banner{align-items:center;background:#edf5fc;display:grid;gap:14px;grid-template-columns:1fr auto 1fr;padding:22px 44px}.medical-prescription__banner:before,.medical-prescription__banner:after{background:#c8dced;content:"";height:1px}.medical-prescription__banner h2{border:0;color:#9b6429;font-size:18px;font-weight:900;letter-spacing:.28em;margin:0;padding:0;text-align:center;text-transform:uppercase}.medical-prescription__body{padding:20px 44px 170px}.medical-prescription__patient{background:#f8fbff;border:1px solid #d7e8f8;border-radius:13px;display:grid;grid-template-columns:1fr auto;gap:24px;margin-bottom:20px;padding:16px 20px}.medical-prescription__patient strong{color:#111827;display:block;font-size:15px;margin:8px 0 3px}.medical-prescription__patient em{display:block;font-style:normal;text-align:right}.medical-prescription__section-title{margin:0 0 14px}.medical-prescription__list{counter-reset:prescription;display:grid;gap:10px;margin:0;padding:0}.medical-prescription__item{align-items:center;background:#fbfdff;border:1px solid #e3edf6;border-radius:13px;counter-increment:prescription;display:grid;gap:16px;grid-template-columns:28px 1fr;line-height:1.45;list-style:none;min-height:54px;padding:13px 18px}.medical-prescription__item:before{align-items:center;align-self:center;background:#9b6429;border-radius:50%;color:#fff;content:counter(prescription);display:flex;font-size:12px;font-weight:900;height:24px;justify-content:center;line-height:24px;width:24px}.medical-prescription__item span{color:#445066;font-size:13px}.medical-prescription__item b{color:#344054}.medical-prescription__empty{background:#fbfdff;border:1px solid #e3edf6;border-radius:13px;color:#8b95a5;font-size:13px;margin:0;padding:14px 18px}.medical-prescription__footer{align-items:end;background:#f4f9fd;border-top:1px solid #e3edf6;bottom:0;display:grid;grid-template-columns:1fr auto;left:0;padding:36px 44px 20px;position:absolute;right:0}.medical-prescription__signature span,.medical-prescription__generated span{color:#9aa5b5;display:block;font-size:12px;margin-bottom:8px}.medical-prescription__signature strong{align-items:center;border:1px dashed #b7d7f3;border-radius:8px;color:#c7cfd9;display:flex;font-size:12px;font-weight:800;height:52px;justify-content:center;width:136px}.medical-prescription__generated{text-align:right}.medical-prescription__brand{align-items:center;background:#fff;border-radius:12px;display:inline-grid;gap:8px;grid-template-columns:26px auto;padding:7px 9px;text-align:left}.medical-prescription__brand img{height:24px;object-fit:contain;width:24px}.medical-prescription__brand b{color:#9b6429;display:block;font-size:11px;text-transform:uppercase}.medical-prescription__brand small{color:#9aa5b5;display:block;font-size:10px}
    @media(max-width:720px){.sheet.invoice-sheet{border-radius:0;margin:0}.mission-invoice__header,.mission-invoice__parties,.mission-invoice__table-head,.mission-invoice__row{grid-template-columns:1fr}.mission-invoice__meta{text-align:left}.mission-invoice__party + .mission-invoice__party{border-left:0;border-top:1px solid #eadccd}.mission-invoice__table-head .right,.mission-invoice__row .right{text-align:left}.mission-invoice__footer{align-items:flex-start;display:grid;gap:8px}}
  </style>
</head>
<body class="${body.includes('mission-invoice') || body.includes('medical-prescription') ? 'invoice-document' : ''}"><main class="sheet${body.includes('mission-invoice') || body.includes('medical-prescription') ? ' invoice-sheet' : ''}${body.includes('medical-prescription') ? ' prescription-sheet' : ''}">${body}</main></body>
</html>`;
    const pdfFileName = fileName.replace(/\.html?$/i, '.pdf');
    void this.renderDesignedDocumentAsPdf(html, pdfFileName);
  }

  private async renderDesignedDocumentAsPdf(html: string, fileName: string): Promise<void> {
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '0';
    host.style.width = '794px';
    host.style.height = '1123px';
    host.style.overflow = 'hidden';
    host.style.background = '#ffffff';
    host.style.zIndex = '-1';
    host.innerHTML = `<style>${styleMatch?.[1] ?? ''}</style>${bodyMatch?.[1] ?? html}`;
    document.body.appendChild(host);

    try {
      await document.fonts?.ready;
      const captureScale = Math.max(3, Math.min(4, (window.devicePixelRatio || 1) * 2));
      const canvas = await html2canvas(host, {
        backgroundColor: '#ffffff',
        scale: captureScale,
        useCORS: true,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
      });
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true,
      });
      this.addCanvasPagesToPdf(pdf, canvas);
      pdf.save(fileName);
    } catch {
      this.feedback.error('Impossible de generer le PDF pour le moment.');
    } finally {
      document.body.removeChild(host);
    }
  }

  private addCanvasPagesToPdf(pdf: jsPDF, canvas: HTMLCanvasElement): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageSliceHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
    let sourceY = 0;
    let pageIndex = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(pageSliceHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext('2d');
      if (!context) {
        throw new Error('PDF canvas context unavailable');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
