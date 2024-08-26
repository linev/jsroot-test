import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('http://localhost:8000/jsroot/?batch&file=https://jsroot.gsi.de/files/hsimple.root&item=hpxpy;1&opt=col&divsize=800x600');


await page.waitForSelector('#jsroot_batch_0');

const element = await page.$('#jsroot_batch_0');
const value = await page.evaluate(el => el.innerHTML, element)

console.log('content', value, typeof value)

await browser.close();

console.log('done');
