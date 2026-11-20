/**
 * Export the whole memorization/revision plan (every scheduled day until the
 * plan finishes) as a clean tabular PDF.
 *
 * Rendering: pages are laid out as A4-sized DOM (native browser Arabic
 * shaping/RTL, so the text is always correct), captured with html-to-image
 * and assembled with jsPDF. On the web the file is downloaded; on Android
 * (Capacitor) it is written to the Documents directory via the Filesystem
 * plugin and the saved path is surfaced to the user.
 *
 * Both heavy libraries are imported dynamically so they stay out of the
 * app's main bundle.
 */

import { Capacitor } from '@capacitor/core';
import { translations, Language } from '@/i18n/translations';
import { surahs } from '@/data/surahs';
import {
  MemorizePlan, QuranBoundaries, SegmentInfo,
  getDayKind, getTaskSegment, getRevisionRanges, describeSegment,
  getJuzRevision, getJuzSpan,
  getTaskDate, getTotalTasks, daysBetween, addDaysToKey,
} from './memorize';

export interface PdfExportResult {
  ok: boolean;
  path?: string;
  error?: string;
}

// A4 at 96dpi
const PAGE_W = 794;
const PAGE_H = 1123;
const ROW_H = 26;

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const AR_WEEKDAYS_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function currentLanguage(): Language {
  return localStorage.getItem('quran-app-language') === 'en' ? 'en' : 'ar';
}

function fmtNum(n: number | string, lang: Language): string {
  const s = String(n);
  return lang === 'ar' ? s.replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : s;
}

function surahName(id: number, lang: Language): string {
  const s = surahs.find(x => x.id === id);
  return s ? (lang === 'ar' ? s.name : s.englishName) : '';
}

interface ScheduleRow {
  dateKey: string;
  isRest: boolean;
  memorize?: { info: SegmentInfo; done: boolean };
  revision?: { pages: string; done: boolean };
  juz?: { juz: number; pages: string };
}

function dateLabel(dateKey: string, lang: Language): { date: string; weekday: string } {
  const d = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)));
  if (lang === 'ar') {
    return { date: `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`, weekday: AR_WEEKDAYS_FULL[d.getDay()] };
  }
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
  };
}

function portionText(info: SegmentInfo, lang: Language): string {
  const name = info.surahFrom === info.surahTo
    ? surahName(info.surahFrom, lang)
    : `${surahName(info.surahFrom, lang)} ${fmtNum(info.ayahFrom, lang)} ← ${surahName(info.surahTo, lang)}`;
  const to = info.surahFrom === info.surahTo ? fmtNum(info.ayahTo, lang) : fmtNum(info.ayahTo, lang);
  const pages = info.pageFrom === info.pageTo
    ? `${fmtNum(info.pageFrom, lang)}`
    : `${fmtNum(info.pageFrom, lang)}–${fmtNum(info.pageTo, lang)}`;
  return `${name} ${fmtNum(info.ayahFrom, lang)}–${to} (${pages})`;
}

function pagesText(info: SegmentInfo, lang: Language): string {
  return info.pageFrom === info.pageTo
    ? `${fmtNum(info.pageFrom, lang)}`
    : `${fmtNum(info.pageFrom, lang)}–${fmtNum(info.pageTo, lang)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildRows(plan: MemorizePlan, b: QuranBoundaries, lang: Language): ScheduleRow[] {
  const t = translations[lang];
  // pure schedule (no checkmarks) so the printed plan is the canonical one
  const schedulePlan: MemorizePlan = { ...plan, completedTasks: [] };
  const total = getTotalTasks(plan, b);
  const lastDate = getTaskDate(plan, total - 1);
  const dayCount = daysBetween(plan.startDate, lastDate) + 1;
  const rows: ScheduleRow[] = [];

  for (let offset = 0; offset < dayCount; offset++) {
    const dateKey = addDaysToKey(plan.startDate, offset);
    const kind = getDayKind(plan, dateKey);
    const row: ScheduleRow = { dateKey, isRest: kind.type !== 'memorize' };

    if (kind.type === 'memorize') {
      const seg = getTaskSegment(plan, b, kind.index);
      if (seg) {
        const info = describeSegment(seg, b);
        row.memorize = {
          info,
          done: plan.completedTasks.includes(kind.index),
        };
        const ranges = getRevisionRanges(schedulePlan, b, kind.index);
        row.revision = {
          pages: ranges.map(r => pagesText(describeSegment({ index: 0, ...r }, b), lang)).join(' • '),
          done: plan.completedRevisions.includes(kind.index),
        };
      }
    }

    const juz = getJuzRevision(schedulePlan, b, dateKey);
    if (juz !== null) {
      const span = getJuzSpan(b, juz);
      const info = describeSegment({ index: 0, ...span }, b);
      row.juz = { juz, pages: pagesText(info, lang) };
    }
    void t;
    rows.push(row);
  }
  return rows;
}

function cellCss(extra = ''): string {
  return `padding:3px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${extra}`;
}

function rowHtml(row: ScheduleRow, lang: Language, showJuz: boolean): string {
  const t = translations[lang];
  const { date, weekday } = dateLabel(row.dateKey, lang);
  const doneMark = (done: boolean) =>
    done ? '<span style="color:#059669;font-weight:700;">✓ </span>' : '';

  let memoCell: string;
  let revCell: string;
  if (row.isRest) {
    memoCell = `<td style="${cellCss('color:#9ca3af;')}">${esc(t.memorizeRestDay)}</td>`;
    revCell = `<td style="${cellCss('color:#9ca3af;')}">—</td>`;
  } else if (row.memorize) {
    memoCell = `<td style="${cellCss()}">${doneMark(row.memorize.done)}${esc(portionText(row.memorize.info, lang))}</td>`;
    revCell = `<td style="${cellCss()}">${row.revision ? `${doneMark(row.revision.done)}${esc(row.revision.pages)}` : '—'}</td>`;
  } else {
    memoCell = `<td style="${cellCss('color:#9ca3af;')}">—</td>`;
    revCell = `<td style="${cellCss('color:#9ca3af;')}">—</td>`;
  }

  const juzCell = showJuz
    ? `<td style="${cellCss()}">${row.juz
        ? `${esc(t.juz)} ${fmtNum(row.juz.juz, lang)} • ${esc(row.juz.pages)}`
        : '—'}</td>`
    : '';

  return `<tr style="height:${ROW_H}px;">
    <td style="${cellCss('width:118px;color:#374151;')}">${esc(date)} <span style="color:#9ca3af;font-size:11px;">${esc(weekday)}</span></td>
    ${memoCell}
    ${revCell}
    ${juzCell}
  </tr>`;
}

function summaryHtml(plan: MemorizePlan, b: QuranBoundaries, lang: Language): string {
  const t = translations[lang];
  const total = getTotalTasks(plan, b);
  const lastDate = getTaskDate(plan, total - 1);
  const unitLabels: Record<string, string> = {
    'ayah': `${plan.ayahsPerDay} ${t.memorizeAyahsUnit}`,
    'half-page': t.memorizeHalfPage,
    'page': t.memorizeOnePage,
    'two-pages': t.memorizeTwoPages,
    'rub': t.memorizeRub,
    'hizb': t.memorizeHizb,
  };
  const freqLabels: Record<string, string> = {
    'off': t.memorizeJuzFreqOff,
    'weekly': t.memorizeJuzFreqWeekly,
    'twice-weekly': t.memorizeJuzFreqTwiceWeekly,
    'monthly': t.memorizeJuzFreqMonthly,
    'twice-monthly': t.memorizeJuzFreqTwiceMonthly,
  };
  const item = (label: string, value: string) =>
    `<div style="display:flex;gap:6px;"><span style="color:#6b7280;">${esc(label)}:</span><span style="font-weight:600;">${esc(value)}</span></div>`;

  const startLabel = dateLabel(plan.startDate, lang).date;
  const endLabel = dateLabel(lastDate, lang).date;
  const freq = plan.juzRevisionFrequency;
  const juzValue = freqLabels[freq] ?? t.memorizeJuzFreqOff;

  return `<div style="margin:10px 0 12px;padding:10px 14px;border:1px solid #d1fae5;border-radius:8px;background:#f0fdf4;display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12px;">
    ${item(t.memorizePdfStart, startLabel)}
    ${item(t.memorizePdfEnd, endLabel)}
    ${item(t.memorizeQuantity, unitLabels[plan.unit] ?? '')}
    ${item(t.memorizePdfTotalTasks, fmtNum(total, lang))}
    ${item(t.memorizeRevision, plan.revisionPages > 0 ? t.memorizeLastPages.replace('{n}', fmtNum(plan.revisionPages, lang)) : t.memorizeRevisionNone)}
    ${item(t.memorizeJuzRevision, juzValue)}
  </div>`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('blob read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function exportMemorizePlanPdf(
  plan: MemorizePlan,
  b: QuranBoundaries
): Promise<PdfExportResult> {
  try {
    const [{ jsPDF }, { toJpeg }] = await Promise.all([
      import('jspdf'),
      import('html-to-image'),
    ]);
    const lang = currentLanguage();
    const t = translations[lang];
    const rows = buildRows(plan, b, lang);
    const showJuz = plan.juzRevisionFrequency !== 'off' && rows.some(r => r.juz);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const total = getTotalTasks(plan, b);
    const lastDate = getTaskDate(plan, total - 1);

    // offscreen page container, reused for every page
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-99999px;top:0;width:${PAGE_W}px;`;
    document.body.appendChild(host);

    const firstPageRows = 30;
    const otherPageRows = 38;
    const pages: { first: boolean; slice: ScheduleRow[] }[] = [];
    for (let i = 0; i < rows.length; i += (pages.length === 0 ? firstPageRows : otherPageRows)) {
      pages.push({ first: pages.length === 0, slice: rows.slice(i, i + (pages.length === 0 ? firstPageRows : otherPageRows)) });
    }
    if (pages.length === 0) pages.push({ first: true, slice: [] });

    try {
      for (let p = 0; p < pages.length; p++) {
        const { first, slice } = pages[p];
        const thead = `<tr style="height:30px;">
          <th style="${cellCss('width:118px;background:#065f46;color:#ffffff;text-align:start;')}">${esc(t.memorizePdfDate)}</th>
          <th style="${cellCss('background:#065f46;color:#ffffff;text-align:start;')}">${esc(t.memorize)}</th>
          <th style="${cellCss('background:#065f46;color:#ffffff;text-align:start;')}">${esc(t.memorizePdfRevisePages)}</th>
          ${showJuz ? `<th style="${cellCss('background:#065f46;color:#ffffff;text-align:start;')}">${esc(t.memorizePdfJuz)}</th>` : ''}
        </tr>`;

        host.innerHTML = `<div style="width:${PAGE_W}px;height:${PAGE_H}px;background:#ffffff;padding:24px;box-sizing:border-box;font-family:'Segoe UI','Noto Sans Arabic',Tahoma,Arial,sans-serif;font-size:12.5px;direction:rtl;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #065f46;padding-bottom:6px;">
            <div style="font-size:20px;font-weight:800;color:#065f46;">${esc(t.appName)} — ${esc(t.memorizePdfTitle)}</div>
            <div style="color:#6b7280;font-size:11px;">${esc(dateLabel(plan.startDate, lang).date)} ← ${esc(dateLabel(lastDate, lang).date)}</div>
          </div>
          ${first ? summaryHtml(plan, b, lang) : ''}
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <thead>${thead}</thead>
            <tbody>${slice.map(r => rowHtml(r, lang, showJuz)).join('')}</tbody>
          </table>
          <div style="position:absolute;bottom:14px;right:24px;left:24px;display:flex;justify-content:space-between;color:#9ca3af;font-size:10px;border-top:1px solid #e5e7eb;padding-top:4px;">
            <span>${esc(t.memorizePdfPage.replace('{n}', fmtNum(p + 1, lang)).replace('{m}', fmtNum(pages.length, lang)))}</span>
            <span>${esc(t.appName)}</span>
          </div>
        </div>`;

        const pageEl = host.firstElementChild as HTMLElement;
        pageEl.style.position = 'relative'; // anchor the footer absolutely
        const dataUrl = await toJpeg(pageEl, {
          width: PAGE_W,
          height: PAGE_H,
          quality: 0.85,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });
        if (p > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297);
      }
    } finally {
      host.remove();
    }

    const filename = `mushafy-memorize-plan-${plan.startDate}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const blob = pdf.output('blob');
      const base64 = await blobToBase64(blob);
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      return { ok: true, path: result.uri };
    }

    pdf.save(filename);
    return { ok: true };
  } catch (err) {
    console.error('memorize plan PDF export failed:', err);
    return { ok: false, error: String(err) };
  }
}
