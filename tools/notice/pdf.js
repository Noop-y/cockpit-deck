const { chromium } = require('playwright');
const path = require('path');
const VERSION = require('../../package.json').version;
const OUT = path.join(__dirname, `The-Deck-notice-v${VERSION}.pdf`);
(async () => { const b = await chromium.launch(); const p = await b.newPage();
 await p.goto('file://' + __dirname + '/notice.html'); await p.waitForTimeout(800);
 await p.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
   headerTemplate: '<div></div>',
   footerTemplate: '<div style="width:100%;font-family:Inter,sans-serif;font-size:8px;color:#8E9BA8;padding:0 15mm;display:flex;justify-content:space-between"><span>The Deck · notice d’utilisation · v' + VERSION + '</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
 await b.close(); })();
