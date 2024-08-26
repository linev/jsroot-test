import puppeteer from 'puppeteer';

import xml_formatter from 'xml-formatter';

import { writeFileSync } from 'fs';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8000/jsroot/?batch&file=https://jsroot.gsi.de/files/hsimple.root&item=hpxpy;1&opt=col&divsize=800x600' /*, {waitUntil: 'networkidle0'}*/);


await page.waitForSelector('#jsroot_batch_final');

const element = await page.$('#jsroot_batch_final');
const snumframes = await page.evaluate(el => el.innerHTML, element);

const numframes = Number.parseInt(snumframes);

console.log('numframes', numframes)


for (let n = 0; n < numframes; ++n) {
   const sub = await page.$(`#jsroot_batch_${n}`);
   const content = await page.evaluate(el => el.innerHTML, sub);

   console.log(`content ${n} len: ${content.length}`);

   let comp2 = xml_formatter(content, { indentation: ' ', lineSeparator: '\n' });

   console.log(comp2);

   writeFileSync(`file${n}.svg`, comp2);
}

await page.close();

await browser.close();

console.log('done');
