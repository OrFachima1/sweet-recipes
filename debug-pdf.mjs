// debug-pdf.mjs — run with: node debug-pdf.mjs
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

const Y_TOLERANCE = 3;

function extractAmount(s) {
  const matches = s.match(/[\d,]+(?:\.\d+)?/g);
  if (!matches) return null;
  const n = parseFloat(matches[matches.length - 1].replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function reconstructLines(items) {
  if (!items.length) return [];
  const groups = [];
  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const str = item.str;
    if (!str && str !== '0') continue;
    let found = false;
    for (const g of groups) {
      if (Math.abs(g.y - y) <= Y_TOLERANCE) {
        g.items.push({ x, str });
        found = true;
        break;
      }
    }
    if (!found) groups.push({ y, items: [{ x, str }] });
  }
  groups.sort((a, b) => b.y - a.y);
  const lines = [];
  for (const g of groups) {
    g.items.sort((a, b) => b.x - a.x);
    let line = g.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    if (line.includes('₪')) {
      line = line.replace(/(\d+)\s+\.\s+(\d+)/g, '$2.$1');
      line = line.replace(/(\d+)\s+,\s+(\d+)/g, '$2,$1');
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function debugPdf(filePath) {
  console.log('\n' + '='.repeat(60));
  console.log('FILE:', filePath);
  console.log('='.repeat(60));

  const buffer = readFileSync(filePath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

  const allLines = [];
  for (let pageIdx = 1; pageIdx <= doc.numPages; pageIdx++) {
    const page = await doc.getPage(pageIdx);
    const content = await page.getTextContent();
    const items = content.items.filter(it => it.str !== undefined);
    const pageLines = reconstructLines(items);
    console.log(`\n--- PAGE ${pageIdx} (${pageLines.length} lines) ---`);
    pageLines.forEach((ln, i) => console.log(`  [${i}] ${ln}`));
    allLines.push(...pageLines);
  }

  console.log('\n--- TOTALS SCAN ---');
  let totalSum = null;
  let deliveryFee = null;
  for (let i = 0; i < allLines.length; i++) {
    const ln = allLines[i];
    if (/סה.{0,5}כ לתשלום/.test(ln)) {
      console.log(`  MATCH סה"כ לתשלום at [${i}]: "${ln}"`);
      console.log(`    extractAmount(current) = ${extractAmount(ln)}`);
      console.log(`    extractAmount(next)    = ${extractAmount(allLines[i+1] || '')}`);
      console.log(`    extractAmount(prev)    = ${extractAmount(allLines[i-1] || '')}`);
      totalSum = extractAmount(ln) ?? extractAmount(allLines[i+1] || '') ?? extractAmount(allLines[i-1] || '') ?? totalSum;
    } else if (['משלוח', 'דמי משלוח', 'הובלה'].some(w => ln.includes(w)) && ln.includes('₪')) {
      console.log(`  MATCH deliveryFee at [${i}]: "${ln}"`);
      deliveryFee = extractAmount(ln) ?? deliveryFee;
    }
  }
  console.log(`\n  → totalSum:    ${totalSum}`);
  console.log(`  → deliveryFee: ${deliveryFee}`);
}

const dir = "c:\\Users\\ah118\\OneDrive\\Desktop\\Projects\\shoval_project\\הצעות מחיר";
const allPdfs = readdirSync(dir).filter(f => f.endsWith('.pdf') && (f.includes('2352') || f.includes('2486')));
const files = allPdfs.map(f => join(dir, f));

for (const f of files) {
  try {
    await debugPdf(f);
  } catch (e) {
    console.error('ERROR:', f, e.message);
  }
}
