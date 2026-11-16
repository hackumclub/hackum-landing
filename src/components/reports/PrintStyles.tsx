// The print stylesheet of the reports: the page itself is the document. A4 portrait, 12 mm margins, no app chrome, no
// buttons, charts and tables never split across pages, one section per page, the brand header on every page, light
// colours and no URLs. Scoped by `data-report-root`, so it only matters on the report pages that render it.
const CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: white !important; color-scheme: light; }
  * { box-shadow: none !important; text-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* App chrome: sidebar, top bar, skip link, dev overlay. */
  .ops-canvas { display: block !important; background: none !important; min-height: 0 !important; }
  .ops-canvas > aside, .ops-canvas > div > header, .ops-canvas > a, nextjs-portal { display: none !important; }
  main { max-width: none !important; width: auto !important; margin: 0 !important; padding: 0 !important; }
  /* Everything around the report on its page: back link, stage, tabs, other buttons. */
  main :is(a, nav, button, [data-stage]):not([data-report-root] *) { display: none !important; }
  [data-noprint], [data-report-root] button, [data-report-root] [role="group"][tabindex] { display: none !important; }

  [data-report-root] { max-width: 186mm; margin: 0 auto; }
  [data-report-root] a { color: inherit !important; text-decoration: none !important; }
  [data-report-root] a[href]::after { content: none !important; }

  /* Brand header: a table-header-group repeats on every printed page. */
  .report-frame { display: table; width: 100%; }
  .report-running { display: table-header-group; }
  .report-running > div { margin-bottom: 6mm; }
  .report-body { display: table-row-group; }

  .report-grid { grid-template-columns: minmax(0, 1fr) !important; }
  .report-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  figure, table, tr, .report-card, .report-comment { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  .report-section + .report-section { break-before: page; }
  .report-scroll { overflow: visible !important; }
}
`;

export default function PrintStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
