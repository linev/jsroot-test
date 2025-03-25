import puppeteer from 'puppeteer';

import xml_formatter from 'xml-formatter';

import { readFileSync, mkdirSync, accessSync, writeFileSync, unlink, constants as fs_constants } from 'fs';

import { compressSVG, atob_func } from 'jsroot';


const server_path = 'http://localhost:8000/jsroot/',
      jsroot_path = './../jsroot',
      examples_main = JSON.parse(readFileSync(`${jsroot_path}/demo/examples.json`)),
      filepath = 'https://jsroot.gsi.de/files/',
      // filepath = 'https://root.cern/js/files/',
      // place for special cases
      specialCases = [
         'TCanvas/time.svg', // position of minor tick differs by one on time axis?
         'TH2/chord.svg', // order of attributes mixes, cannot repair while produced inside d3
         'TH3/box.svg', // not working filter out of image
         'Misc/roofit_rf101_plot2.svg', // very tiny diff in axis drawing
         'Misc/roofit_rf201_plot1.svg',
         'Misc/roofit_rf708_plot6.svg'
      ];


let init_curve = false, init_palette = 57, init_TimeZone = '',
    test_mode = 'verify', nmatch = 0, ndiff = 0, nnew = 0, nspecial = 0,
    keyid = 'TH1', theonlykey = false, firstoptid = -1, optid = -1, printdiff = false, show_debug = false,
    theOnlyOption, theOnlyOptionId = -100,
    entry, entry_name = '', testfile = null, testobj = null,
    last_time = new Date().getTime(),
    test_interactive = false,
    filename = '', itemname = '', jsonname = '';

const all_diffs = [], all_special = [];

if (process.argv && (process.argv.length > 2)) {
   for (let cnt=2; cnt<process.argv.length; ++cnt) {
      switch (process.argv[cnt]) {
         case '-v':
         case '--verify':
            test_mode = 'verify';
            break;
         case '-c':
         case '--create':
            test_mode = 'create';
            break;
         case '-k':
         case '--key':
            keyid = process.argv[++cnt];
            theonlykey = true;
            if (!keyid || !examples_main[keyid]) {
               console.log('Key not found', keyid);
               process.exit();
            }
            break;
         case '-o':
         case '--opt':
            theOnlyOption = process.argv[++cnt];
            theOnlyOptionId = parseInt(theOnlyOption);
            if (isNaN(theOnlyOptionId) || (theOnlyOptionId < 0) || !examples_main[keyid][theOnlyOptionId])
               theOnlyOptionId = -100;
            else {
               console.log('Select option', examples_main[keyid][theOnlyOptionId], 'for key', keyid);
               optid = theOnlyOptionId - 1;
               theOnlyOption = '';
            }
            break;
         case '-f':
         case '--first':
            firstoptid = parseInt(process.argv[++cnt]);
            if (isNaN(firstoptid))
               firstoptid = -1;
            else
               console.log('starting from ', firstoptid);
            break;
         case '-m':
         case '--more': {
            const examples_more = JSON.parse(readFileSync(`${jsroot_path}/demo/examples_more.json`));

            for (const key in examples_more) {
               if (examples_main[key])
                  examples_main[key].push(...examples_more[key]);
               else
                  examples_main[key] = examples_more[key];
            }
            break;
         }
         case '-i':
         case '--interactive':
            test_interactive = true;
            break;
         case '-d':
         case '--debug':
            show_debug = true;
            break;
         case '-p':
         case '--print':
            printdiff = true;
            break;
         case '-ni':
         case '--not-interactive':
            test_interactive = 0;
            break;
         default:
            console.log('Usage: node test.js [options]');
            console.log('   -v | --verify : check stored content against current JSROOT version');
            console.log('   -c | --create : perform checks and overwrite when results differ');
            console.log('   -k | --key keyname : select specific key (class name) like TH1 or TProfile for testing');
            console.log('   -o | --opt id : select specific option id (number or name), only when key is specified');
            console.log('   -f | --first id : start from specified id, only when key is specified');
            console.log('   -m | --more : use more tests');
            console.log('   -d | --debug : show debug information');
            console.log('   -i | --interactive : enable interactivity checks (except TGeo)');
            console.log('   -p | --print : print difference when files changes');
            process.exit();
      }
   }
}

// add extra examples at the end

examples_main.TH1.push({ name: 'B_local', file: '../jstests/other/hsimple.root', item: 'hpx;1', opt: 'B,fill_green', title: 'draw histogram as bar chart' });
examples_main.TTree.push({ name: '2d_local', asurl: true, file: '../jstests/other/hsimple.root', item: 'ntuple', opt: 'px:py', title: 'Two-dimensional TTree::Draw' });


const browser = await puppeteer.launch();

const ver = await browser.version();

console.log('using browser', ver);

const page = await browser.newPage();


function resetPdfFile(pdfFile) {
   pdfFile = pdfFile.replace(/\/CreationDate \(D:(.*?)\)/, "/CreationDate (D:20231117000000+00'00')");
   pdfFile = pdfFile.replace(
     /(\/ID \[ (<[0-9a-fA-F]+> ){2}\])/,
     '/ID [ <00000000000000000000000000000000> <00000000000000000000000000000000> ]'
   );
   pdfFile = pdfFile.replace(/(\/Producer \(jsPDF [1-9].[0-9].[0-9]\))/, '/Producer (jsPDF 1.0.0)');
   return pdfFile;
 }

// Description: Helper functions to remove <image> tags from svg files
// Function to remove <image> tags from SVG content
function cleanSVG(svgContent) {
   const regex = /\<image[^>]*\/?>/g; // Regex to match <image> tags
   return svgContent.replace(regex, ''); // Remove all <image> tags
}

// Function to compare two SVG files, excluding <image> tags
function compareSVGs(svgContent1, svgContent2) {
   try {
      const cleanedSvg1 = cleanSVG(svgContent1);
      const cleanedSvg2 = cleanSVG(svgContent2);
      return cleanedSvg1 === cleanedSvg2;
   } catch (error) {
      console.error('Error comparing SVG:', error);
      return false;
   }
}

function produceFile(content, extension, subid) {
   if (!entry_name) entry_name = keyid;

   entry_name = entry_name.replace(/ /g, '_')
                          .replace(/\+/g, 'p').replace(/>/g, 'more')
                          .replace(/</g, 'less').replace(/\|/g, 'I')
                          .replace(/\[/g, 'L').replace(/\]/g, 'J').replace(/\*/g, 'star');

   let use_name = entry_name;

   if (entry.items) {
      use_name += '_' + entry.items[subid];
      if (entry.opts && entry.opts[subid])
         use_name += '_' + entry.opts[subid];
   } else if (subid)
      use_name += '_' + subid;

   if ((extension === '.svg') && content) {
      content = compressSVG(content);
      content = xml_formatter(content, { indentation: ' ', lineSeparator: '\n' });
   }

   try {
      accessSync(keyid, fs_constants.W_OK);
   } catch (err) {
      mkdirSync(keyid);
   }

   const svgname = keyid + '/' + use_name + extension,
         ispng = (extension === '.png'),
         ispdf = (extension === '.pdf');
   let svg0 = null, result = 'MATCH';

   if (ispng) {
      const prefix = 'data:image/png;base64,';
      if (content.slice(0, prefix.length) !== prefix) {
         console.error('NOT a PNG href provided');
         content = '';
      } else {
         content = Buffer.from(content.slice(prefix.length), 'base64');
         if (show_debug)
            console.log('png image size', content.byteLength);
      }
   }

   const clen = content.length ?? content.byteLength ?? 0;

   try {
      svg0 = readFileSync(svgname, ispng || ispdf ? undefined : 'utf-8');

      //let match = (svg0 === content); //Uncomment for comparison without <image> handling
      //Description: Comparison with <image> handling
      let match = false;

      if (ispng) {
         match = (svg0?.byteLength === clen);

         if (match) {
            const view0 = new Int8Array(svg0),
                  view1 = new Int8Array(content);
            for (let i = 0; i < clen; ++i) {
               if (view0[i] !== view1[i]) {
                  match = false; break;
               }
            }
         }
     } else if (ispdf) {
        match = (svg0?.byteLength === clen);
        const pdf1 = resetPdfFile(svg0.toString()),
              pdf2 = resetPdfFile(content.toString());
        if (pdf1 !== pdf2) match = false;
        content = Buffer.from(pdf2); // write reformated data
     } else {
        match = compareSVGs(svg0, content);
     }

      if (!match)
        result = ispng || specialCases.includes(svgname) || entry.r3d || entry.reset_mathjax ? 'SPECIAL' : 'DIFF';

   } catch (e) {
     svg0 = null;
     result = 'NEW';
   }

//   // workaround to ignore alice variation, to let enable TGeo testings
// if ((result === 'DIFF') && (keyid === 'TGeo') && (entry_name == 'alice') && (Math.abs(svg0.length - content.length) < 0.01*svg0.length)) {
//      console.log('!! Ignore alice variation for now !!');
//      content = svg0;
//      result = 'MATCH';
//   }

   switch (result) {
      case 'NEW': nnew++; break;
      case 'DIFF': ndiff++; break;
      case 'SPECIAL': nspecial++; break;
      default: nmatch++;
   }

   const clen0 = svg0?.length ?? svg0?.byteLength ?? 0;
   console.log(keyid, use_name + (ispng || ispdf ? extension : ''), 'result', result, 'len='+clen, (clen0 && result === 'DIFF' ? 'rel0='+(100*clen/clen0).toFixed(1)+'%' : ''));

   if (result === 'DIFF')
      all_diffs.push(svgname);
   if (result === 'SPECIAL')
      all_special.push(svgname)

   if ((result === 'NEW') || ((test_mode === 'create') && (result === 'DIFF'))) {
      if (clen > 0) {
         writeFileSync(svgname, content, ispng ? undefined : 'utf-8');
         if (printdiff && (result !== 'NEW'))
            exec(`git diff ${svgname}`, (err, output) => { console.log(output); })

      } else if (result !== 'NEW')
         unlink(svgname);
   }
}

function processURL(url) {
   let fullurl = server_path;
   if (entry.aspng)
      fullurl += '?batch=png&';
   else
      fullurl += '?batch&';

   fullurl += 'canvsize=1200x800&';

   fullurl += 'smallpad=40x40&';

   fullurl += 'approx_text_size&'; // to have exactly same text width estimation as in node.js

   fullurl += url;

   if (show_debug)
      console.log('optid', optid, 'url', fullurl);

   let numframes = 1;

   return page.goto(fullurl)
              .then(() => page.waitForSelector('#jsroot_batch_final'))
              .then(() => page.$('#jsroot_batch_final'))
              .then(element => page.evaluate(el => el.innerHTML, element))
              .then(snumframes => {
                  numframes = Number.parseInt(snumframes);
                  const prs = [];

                  for (let n = 0; n < numframes; ++n)
                     prs.push(page.$(`#jsroot_batch_${n}`).then(sub => page.evaluate(el => el.innerHTML, sub)));

                  return Promise.all(prs);
               }).then(contents => {
                  for (let n = 0; n < numframes; ++n) {
                     const content = contents[n];
                     if (content.indexOf('json:') === 0)
                        produceFile(atob_func(content.slice(5)), '.json', n);
                     else if (content.indexOf('png:') === 0)
                        produceFile(content.slice(4), '.png', n);
                     else if (entry.aspng)
                        console.error('expeting PNG image');
                     else
                        produceFile(content, '.svg', n);

                  }
                  return page.goto('about:blank');
               });
}

function structuredLogger(level, message, details = {}) {
   console.log(JSON.stringify({ level, message, ...details, timestamp: new Date().toISOString() }));
}

function processNextOption() {
   if (!keyid) {
      if (all_diffs.length)
         console.log('ALL DIFFS', all_diffs);
      if (all_special.length)
         console.log('ALL SPECIAL', all_special);
      console.log('No more data to process');
      console.log('SUMMARY: match', nmatch, 'diff', ndiff, 'new', nnew, 'special', nspecial);

      // Description: If one file pair differs, the test fails
      if (ndiff > 0) {
         structuredLogger('ERROR', 'Not all files match', { diffCount: ndiff });
      }
      return Promise.resolve(true);
   }

   const curr_time = new Date().getTime();
   if (curr_time - last_time > 10000) {
      last_time = curr_time;
      return new Promise(resolveFunc => {
         setTimeout(resolveFunc, 1);
      }).then(() => processNextOption());
   }


   const opts = examples_main[keyid];
   if (!opts) return Promise.resolve(true);

   if (theOnlyOptionId === optid) {
      keyid = null;
      return processNextOption();
   }
   if (++optid >= opts.length) {
      optid = firstoptid;
      let found = false, next = null;
      for (const key in examples_main) {
         // if (key === "TGeo") continue; // skip already here
         if (found) { next = key; break; }
         if (key === keyid) found = true;
      }

      keyid = next;
      if (theonlykey) keyid = null;
      return processNextOption();
   }

   entry = opts[optid];

   if ((theOnlyOptionId >= 0) && !entry.file && !entry.json && !entry.url) {
      let rid = optid;
      while (--rid >= 0) {
         const sentry = opts[rid];
         if (sentry.file && sentry.item) {
            entry.file = sentry.file; entry.item = sentry.item; break;
         }
      }
   }

   entry_name = '';

   // exclude some entries from the test
   if (entry.notest)
      return processNextOption();

   let url = '', opt = '', opt2 = '';

   if (entry.file) {
      jsonname = '';
      filename = entry.file;
      if ((filename.indexOf('http:') < 0) && (filename.indexOf('https:') < 0) && (filename.indexOf('../jstests/other/') !== 0))
         filename = filepath + filename;
   }
   if (entry.item) {
      jsonname = '';
      itemname = entry.item;
   }

   opt = entry.testopt ?? entry.opt ?? '';

   if (entry.json) {
      filename = itemname = '';
      jsonname = entry.json;
      if ((jsonname.indexOf('http:') < 0) && (jsonname.indexOf('https:') < 0))
         jsonname = filepath + jsonname;
   }

   if (entry.r3d)
      opt2 = (opt ? ',' : '') + 'r3d_' + entry.r3d;

   if (entry.url)
      url = entry.url.replace(/\$\$\$/g, filepath)
                     .replace(/file=demo/g, `file=${jsroot_path}/demo`)
                     .replace(/nobrowser&/g, '');
   else if (entry.asurl) {
      if (keyid === 'TTree') {
         if ((opt.indexOf('>>') < 0) && (opt.indexOf('dump') < 0) && (opt.indexOf('testio') < 0))
            opt += '>>dump;num:10';
      }
   }

   // if ((opt=='inspect') || (opt=='count')) return processNextOption();

   if (entry.name)
      entry_name = entry.name;
   else
      entry_name = opt || keyid;

   if (theOnlyOption) {
      if (entry_name !== theOnlyOption)
         return processNextOption();
      console.log('Select option', entry);
   }

   if (!url) {

      if (jsonname)
         url += 'json=' + jsonname;
      else {
         url = 'file=' + filename;

         if (entry.style)
            url += `&style=${entry.style}`;

         if (entry.items) {
            opt = opt2 = '';
            if (entry.layout) url += `&layout=${entry.layout}`;
            url += `&items=[${entry.items.join(',')}]`;
            if (entry.opts) url += `&opts=[${entry.opts.join(',')}]`;
         } else {
            url += '&item=' + itemname;
         }
      }

      if (opt + opt2)
         url += `&opt=${opt+opt2}`;

      if (entry.mathjax)
         url += '&mathjax';
      if (entry.latex)
         url += `&latex=${entry.latex}`;

      if (entry.timezone) {
         if (entry.timezone === 'UTC')
            url += '&utc';
         else if (entry.timezone === 'Europe/Berlin')
            url += '&cet';
         else
            url += `&timezone='${entry.timezone}'`;
      }
   }

   let pr = Promise.resolve(true);

   if ((firstoptid < 0) || (optid >= firstoptid))
      pr = processURL(url);

   return pr.then(() => processNextOption());
}

await processNextOption();

await page.close();

await browser.close();
