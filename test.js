import { gStyle, version_id, source_dir, version_date, create, settings, constants, setHPainter,
         internals, httpRequest, openFile, makeImage, readStyleFromURL, clTList,
         HierarchyPainter, createRootColors, loadMathjax } from 'jsroot';

import { testInteractivity } from 'jsroot/testing';

import { readFileSync, mkdirSync, accessSync, writeFileSync, unlink, constants as fs_constants } from 'fs';

import { exec } from 'node:child_process';

import xml_formatter from 'xml-formatter';

console.log(`JSROOT version  ${version_id} ${version_date}`);

const jsroot_path = './..' + source_dir.slice(source_dir.lastIndexOf('/', source_dir.length - 2)), // extract last dir name for JSROOT
      examples_main = JSON.parse(readFileSync(`${jsroot_path}/demo/examples.json`)),
      filepath = 'https://jsroot.gsi.de/files/',
      jsonfilepath = 'http://jsroot.gsi.de/files/', // httpRequest has problem with GSI https
      root_cern = 'https://root.cern/',
      alt_root_cern = 'https://root-eos.web.cern.ch/',
      // filepath = 'https://root.cern/js/files/',
      // jsonfilepath = 'https://root.cern/js/files/',
      // place for special cases
      specialCases = [ 'TCanvas/time.svg' ],  // position of minor tick differs by one on time axis?
      dflt_latex = settings.Latex;

// uncomment to be able use https with jsroot.gsi.de server
//  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// reduce size of small pad for batch mode
settings.SmallPad.width = 40;
settings.SmallPad.height = 40;
settings.UseStamp = false;
settings.FilesTimeout = 10000; // file operation at max 10 sec


let init_style = null, init_curve = false, init_palette = 57, init_TimeZone = '', init_DarkMode = false, init_scale = 1,
    test_mode = 'verify', test_pdf = true, nmatch = 0, ndiff = 0, nnew = 0, nspecial = 0,
    keyid = 'TH1', theonlykey = false, optid = -1, printdiff = false,
    theOnlyOption, theOnlyOptionId = -100, itemid = -1,
    entry, entry_name = '', lastitemname = '', testfile = null, testobj = null,
    last_time = new Date().getTime(),
    test_interactive = false, show_debug = false;

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
         case '--no-pdf':
            test_pdf = false;
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
         case '-p':
         case '--print':
            printdiff = true;
            break;
         case '-d':
         case '--debug':
            show_debug = true;
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
            console.log('   -m | --more : use more tests');
            console.log('   -i | --interactive : enable interactivity checks (except TGeo)');
            console.log('   -p | --print : print difference when files changes');
            process.exit();
      }
   }
}

// add extra examples at the end to have clear indexing
examples_main.TH1.push({ name: 'B_local', file: 'file://other/hsimple.root', item: 'hpx;1', opt: 'B,fill_green', title: 'draw histogram as bar chart' });
examples_main.TTree.push({ name: '2d_local', asurl: true, file: 'file://other/hsimple.root', item: 'ntuple', opt: 'px:py', title: 'Two-dimensional TTree::Draw' });


function produceGlobalStyleCopy() {
   // copy style when painter is loaded
   if (!init_style && gStyle) {
      init_style = Object.assign({}, gStyle);
      init_palette = settings.Palette;
      init_scale = settings.CanvasScale;
      init_curve = settings.FuncAsCurve;
      init_TimeZone = settings.TimeZone;
      init_DarkMode = settings.DarkMode;
   }
}

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
   if (subid)
      use_name += '_' + subid;

   if ((extension === '.svg') && content)
      content = xml_formatter(content, { indentation: ' ', lineSeparator: '\n' });

   try {
      accessSync(keyid, fs_constants.W_OK);
   } catch (err) {
      mkdirSync(keyid);
   }

   const svgname = keyid + '/' + use_name + extension,
         ispng = (extension === '.png'),
         ispdf = (extension === '.pdf'),
         clen = content.length ?? content.byteLength;
   let svg0 = null, result = 'MATCH';

   try {
     svg0 = readFileSync(svgname, ispng || ispdf ? undefined : 'utf-8');

     //let match = (svg0 === content); // Uncommnet for comparions without <image> handling
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
        const pdf1 = resetPdfFile(svg0.toString()),
              pdf2 = resetPdfFile(content.toString());
        match = (pdf1 === pdf2);
        // keep PDF content as is - with new date and id if any
        // content = Buffer.from(pdf2); // write reformated data
     } else {
        match = compareSVGs(svg0, content);
     }

      if (!match)
        result = ispng || specialCases.includes(svgname) || entry.r3d ? 'SPECIAL' : 'DIFF';

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

   if ((result === 'NEW') || ((test_mode === 'create') && (result !== 'MATCH'))) {
      if (clen > 0) {
         writeFileSync(svgname, content);
         if (printdiff && (result !== 'NEW'))
            exec(`git diff ${svgname}`, (err, output) => { console.log(output); })

      } else if (result !== 'NEW')
         unlink(svgname);
   }
}

function produceSVG(object, option) {
   // use only for object reading
   if ((theOnlyOptionId >= 0) && theOnlyOptionId !== optid)
      return processNextOption();

   if (entry.reset_funcs)
      object.fFunctions = create(clTList);

   const args = { format: 'svg', object, option, width: 1200, height: 800, use_canvas_size: !entry.large };

   if (entry.aspng) {
      args.format = 'png';
      args.as_buffer = true;
   }

   makeImage(args).then(code => {
      if (entry.reset_funcs)
          object.fFunctions = create(clTList);
      produceFile(code, entry.aspng ? '.png' : '.svg');

      if (entry.pdf && test_pdf) {
         args.format = 'pdf';
         args.as_buffer = true;
         return makeImage(args).then(code => {
            produceFile(code, '.pdf');
         });
      }
   }).then(() => {
       let do_testing = (entry.interactive !== false) &&
                        ((entry.interactive && test_interactive !== 0) ||
                         (test_interactive && (keyid !== 'TGeo')));

       return do_testing ? testInteractivity(args) : true;
   }).then(() => processNextOption());
}

function processURL(url) {
   readStyleFromURL(url);

   const hpainter = new HierarchyPainter('testing', null);

   setHPainter(hpainter);

   hpainter.setDisplay('batch');

   hpainter.createDisplay()
           .then(() => hpainter.startGUI(null, url))
           .then(() => {
      const disp = hpainter.getDisplay();
      if (disp.numFrames() === 0) {
         console.log(' Processing url: ', url);
         console.log('   !!! BATCH URL CREATES NO FRAME !!!', keyid, entry_name);
      }
      for (let n = 0; n < disp.numFrames(); ++n) {
         const json = disp.makeJSON(n, 1);
         if (json) produceFile(json, '.json', n);
         const svg = json ? '' : disp.makeSVG(n);
         if (svg) produceFile(svg, '.svg', n);
      }

      setHPainter(null);

      processNextOption();
   });
}

function structuredLogger(level, message, details = {}) {
   console.log(JSON.stringify({ level, message, ...details, timestamp: new Date().toISOString() }));
}

function processNextOption(reset_mathjax, skip_increment) {
   if (!keyid) {
      if (all_diffs.length)
         console.log('ALL DIFFS', all_diffs);
      if (all_special.length)
         console.log('ALL SPECIAL', all_special);
      console.log('No more data to process');
      if (internals.RemapCounter)
         console.log('Using files REMAP: ', internals.RemapCounter);
      console.log('SUMMARY: match', nmatch, 'diff', ndiff, 'new', nnew, 'special', nspecial);
      // Description: If one file pair differs, the test fails
      if (ndiff > 0) {
         structuredLogger('ERROR', 'Not all files match', { diffCount: ndiff });
         process.exit(1);
      }
      return;
   }

   // make timeout to avoid deep callstack
   const curr_time = new Date().getTime();
   if ((curr_time - last_time > 10000) && !reset_mathjax) {
      last_time = curr_time;
      return setTimeout(() => processNextOption(), 1);
   }

   const opts = examples_main[keyid];
   if (!opts) return;

   if (!reset_mathjax && !skip_increment) {
      if ((itemid >= 0) && (++itemid >= opts[optid].items.length))
         itemid = -1;

      if (itemid < 0) { // first check that all items are processed
         if (theOnlyOptionId === optid) {
            keyid = null;
            return processNextOption();
         }
         if (++optid >= opts.length) {
            optid = -1;
            let found = false, next = null;
            for (const key in examples_main) {
               // if (key === "TGeo") continue; // skip already here
               if (found) { next = key; break; }
               if (key === keyid) found = true;
            }

            keyid = next;
            if (theonlykey) keyid = null;
            lastitemname = '';
            return processNextOption();
         }
      }
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

   if (((entry.latex === 'mathjax') || entry.reset_mathjax) && !reset_mathjax) {
      return loadMathjax().then(mj => {
         mj.startup.defaultReady();
         console.log('Loading MathJax and doing extra reset!!!')
         processNextOption(true);
      });
   }


   let filename = '', itemname = '', jsonname = '', url = '', opt = '', opt2 = '';

   if (show_debug && (entry._process_style === undefined))
      console.log('id', optid, 'entry', JSON.stringify(entry));

   if (entry.file) {
       filename = entry.file;
       if ((filename.indexOf('http:') < 0) &&
           (filename.indexOf('https:') < 0) &&
           (filename.indexOf('file:') < 0))
              filename = filepath + filename;
   }
   if (entry.item)
      itemname = entry.item;

   if (entry.testopt !== undefined)
      opt = entry.testopt;
   else if (entry.opt)
      opt = entry.opt;

   if (entry.json) {
      lastitemname = '';
      jsonname = entry.json;
      if ((jsonname.indexOf('http:') < 0) && (jsonname.indexOf('https:') < 0))
         jsonname = jsonfilepath + jsonname;
   }
   if (entry.items) {
      lastitemname = '';
      if ((itemid < 0) && (!entry.style || entry._process_style))
         itemid = 0;
      if (itemid >= 0) {
         itemname = entry.items[itemid];
         if (entry.opts && (itemid < entry.opts.length))
            opt = entry.opts[itemid];
      }
   }

   if (entry.r3d)
      opt2 = (opt ? ',' : '') + 'r3d_' + entry.r3d;

   if (entry.url) {
      lastitemname = '';
      url = '?' + entry.url.replace(/\$\$\$/g, filepath)
                           .replace(/file=demo/g, `file=${jsroot_path}/demo`);
   } else if (entry.asurl) {
      url = ((entry.asurl === 'browser') ? '?' : '?nobrowser&');
      url += jsonname ? 'json=' + jsonname : 'file=' + filename + '&item=' + itemname;
      if (keyid === 'TTree') {
         if ((opt.indexOf('>>') < 0) && (opt.indexOf('dump') < 0) && (opt.indexOf('elist') < 0) && (opt.indexOf('testio') < 0))
            opt += '>>dump;num:10';
      }
      url += '&opt=' + opt + opt2;
      lastitemname = '';
   }

   // if ((opt=='inspect') || (opt=='count')) return processNextOption();

   if (itemid >= 0)
      entry_name = (entry.name || keyid) + '_' + itemname + (opt ? '_' + opt : '');
   else if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt || keyid;

   if (theOnlyOption) {
      if (entry_name !== theOnlyOption) return processNextOption();
      console.log('Select option', entry);
   }

   produceGlobalStyleCopy();
   if (!entry.style && init_style)
      Object.assign(gStyle, init_style);

   settings.Palette = init_palette;
   settings.CanvasScale = init_scale;
   settings.FuncAsCurve = init_curve;
   settings.TimeZone = entry.timezone ?? init_TimeZone;
   settings.DarkMode = init_DarkMode;

   // ensure default options
   createRootColors(); // ensure default colors

   if (entry.latex)
      settings.Latex = constants.Latex.fromString(entry.latex);
   else
      settings.Latex = dflt_latex;

   // seedrandom('hello.', { global: true }); // set global random
   internals.id_counter = 1; // used in some custom styles

   if (url.length > 0) {
      testfile = testobj = null;
      return processURL(url);
   } else if (jsonname.length > 0) {
      testfile = testobj = null;
      httpRequest(jsonname, 'object').then(obj => {
         testobj = obj;
         produceSVG(testobj, opt+opt2);
      });
   } else if (filename.length > 0) {
      openFile(filename).then(file => {
         testfile = file;
         if (entry.style && !entry._process_style) {
            entry._process_style = true;
            testfile.readObject(entry.style).then(st => {
               produceGlobalStyleCopy();
               // first create copy of existing style
               // then apply changes to the
               Object.assign(gStyle, st);
               processNextOption(false, true);
            });
         } else {
            testfile.readObject(itemname).then(obj => {
               testobj = obj;
               lastitemname = itemname;
               produceSVG(testobj, opt+opt2);
            });
         }
      });
   } else if (itemname || lastitemname) {
      testfile.readObject(itemname || lastitemname).then(obj => {
         testobj = obj;
         if (itemname)
            lastitemname = itemname;
         produceSVG(testobj, opt+opt2);
      });
   } else {
      console.error('!!!!!!!!!!!!!  SHOULD NEVER HAPPEN!!!!!!!!!!!!!!!!!!!111');
      process.exit(1);
   }
}

processNextOption();


