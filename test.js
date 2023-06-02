import { gStyle, version_id, version_date, create, settings, constants, internals, httpRequest, openFile, makeSVG, readStyleFromURL } from 'jsroot';

console.log(`JSROOT version  ${version_id} ${version_date}`);

import { createRootColors } from 'jsroot/colors';

import { HierarchyPainter } from 'jsroot/hierarchy';

import { loadMathjax } from 'jsroot/latex';

import { readFileSync, mkdirSync, accessSync, writeFileSync, unlink, constants as fs_constants } from 'fs';

import xml_formatter from 'xml-formatter';


let examples_main = JSON.parse(readFileSync("./../old_jsroot/demo/examples.json"));

examples_main.TH1.push({ name: "B_local", file: "file://other/hsimple.root", item: "hpx;1", opt:"B,fill_green", title: "draw histogram as bar chart" });
examples_main.TTree.push({ name: "2d_local", asurl: true, file: "file://other/hsimple.root", item: "ntuple", opt: "px:py", title: "Two-dimensional TTree::Draw" });

let init_style = null, init_palette = 57,
    test_mode = "verify", nmatch = 0, ndiff = 0, nnew = 0,
    keyid = 'TH1', theonlykey = false, optid = -1,
    theOnlyOption, theOnlyOptionId = -100, itemid = -1,
    entry, entry_name = "", testfile = null, testobj = null,
    all_diffs = [],
    last_time = new Date().getTime();

if (process.argv && (process.argv.length > 2)) {

   for (let cnt=2;cnt<process.argv.length;++cnt)
      switch (process.argv[cnt]) {
        case "-v":
        case "--verify":  test_mode = "verify"; break;
        case "-c":
        case "--create": test_mode = "create"; break;
        case "-k":
        case "--key":
           keyid = process.argv[++cnt];
           theonlykey = true;
           if (!keyid || !examples_main[keyid]) {
               console.log('Key not found', keyid);
               process.exit();
           }
           break;
        case "-o":
        case "--opt":
           theOnlyOption = process.argv[++cnt];
           theOnlyOptionId = parseInt(theOnlyOption);
           if (isNaN(theOnlyOptionId) || (theOnlyOptionId<0) || !examples_main[keyid][theOnlyOptionId]) {
              theOnlyOptionId = -100;
           } else {
              console.log('Select option', examples_main[keyid][theOnlyOptionId], 'for key', keyid);
              optid = theOnlyOptionId - 1;
              theOnlyOption = "";
           }
           break;
        case "-m":
        case "--more":
           let examples_more = JSON.parse(readFileSync("./../old_jsroot/demo/examples_more.json"));

           for (let key in examples_more) {
              if (examples_main[key])
                 examples_main[key].push(...examples_more[key]);
              else
                 examples_main[key] = examples_more[key];
           }
           break;
        case "-i":
        case "--ignore":
            process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
            break;

        default:
           console.log('Usage: node test.js [options]');
           console.log('   -v | --verify : check stored content against current JSROOT version');
           console.log('   -c | --create : perform checks and overwrite when results differ');
           console.log('   -k | --key keyname : select specific key (class name) like TH1 or TProfile for testing');
           console.log('   -o | --opt id : select specific option id (number or name), only when key is specified');
           console.log('   -m | --more : use more tests');
           console.log('   -i | --ignore : ignore TLS checks');
           process.exit();
      }
}

function ProduceGlobalStyleCopy() {
   // copy style when painter is loaded
   if (!init_style && gStyle) {
      init_style = Object.assign({}, gStyle);
      init_palette = settings.Palette;
   }
}

function ProduceFile(content, extension, subid) {
   if (!entry_name) entry_name = keyid;

   entry_name = entry_name.replace(/ /g, '_')
                          .replace(/\+/g,'p').replace(/\>/g,'more')
                          .replace(/\</g,'less').replace(/\|/g,'I')
                          .replace(/\[/g,'L').replace(/\]/g,'J').replace(/\*/g,'star');

   let use_name = entry_name;
   if (subid)
      use_name += "_" + subid;

   if (extension != ".json")
      content = xml_formatter(content, {indentation: ' ', lineSeparator: '\n' });

   try {
      accessSync(keyid, fs_constants.W_OK);
   } catch(err) {
      mkdirSync(keyid);
   }

   let svgname = keyid + "/" + use_name + extension,
       svg0 = null, result = "MATCH";

   try {
     svg0 = readFileSync(svgname, 'utf-8');
     if (svg0 != content) result = "DIFF";
   } catch(e) {
     svg0 = null;
     result = "NEW";
   }

//   // workaround to ignore alice variation, to let enable TGeo testings
// if ((result == "DIFF") && (keyid == "TGeo") && (entry_name == "alice") && (Math.abs(svg0.length - content.length) < 0.01*svg0.length)) {
//      console.log('!! Ignore alice variation for now !!');
//      content = svg0;
//      result = "MATCH";
//   }

   switch (result) {
      case "NEW": nnew++; break;
      case "DIFF": ndiff++; break;
      default: nmatch++;
   }

   let clen = content ? content.length : -1;
   console.log(keyid, use_name, 'result', result, 'len='+clen, (svg0 && result=='DIFF' ? 'rel0='+(clen/svg0.length*100).toFixed(1)+'\%' : ''));

   if (result === "DIFF") all_diffs.push(svgname);

   if ((result === "NEW") || ((test_mode === 'create') && (result!=='MATCH'))) {
      if (clen > 0)
         writeFileSync(svgname, content);
      else if (result !== "NEW")
         unlink(svgname);
   }

   if (subid === undefined) processNextOption();
}

function ProduceSVG(obj, opt) {

   // use only for object reading
   if ((theOnlyOptionId >= 0) && theOnlyOptionId !== optid)
      return processNextOption();

  if (entry.reset_funcs) obj.fFunctions = create("TList");

   makeSVG({ object: obj, option: opt, width: 1200, height: 800 })
         .then(svg => {
            ProduceFile(svg, ".svg");
            if (entry.reset_funcs) obj.fFunctions = create("TList");
         });
}

function ProcessURL(url) {

   readStyleFromURL(url);

   let hpainter = new HierarchyPainter("testing", null);

   hpainter.setDisplay('batch');

   hpainter.createDisplay()
           .then(() => hpainter.startGUI(null, url))
           .then(() => {

      let disp = hpainter.getDisplay();
      if (disp.numFrames() == 0) {
         console.log(' Processing url: ', url);
         console.log('   !!! BATCH URL CREATES NO FRAME !!!', keyid, entry_name);
      }
      for (let n = 0; n < disp.numFrames(); ++n) {
         let json = disp.makeJSON(n, 1);
         if (json) ProduceFile(json, ".json", n);
         let svg = json ? "" : disp.makeSVG(n);
         if (svg) ProduceFile(svg, ".svg", n);
      }

      processNextOption();
   });
}


function processNextOption(reset_mathjax) {

   if (!keyid) {
      if (all_diffs.length) console.log("ALL DIFFS", all_diffs);
      console.log('No more data to process');
      console.log("SUMMARY: match", nmatch, "diff", ndiff, "new", nnew);
      return;
   }

   // make timeout to avoid deep callstack
   let curr_time = new Date().getTime();
   if ((curr_time - last_time > 10000) && !reset_mathjax) {
      last_time = curr_time;
      return setTimeout(() => processNextOption(), 1);
   }

   let opts = examples_main[keyid];
   if (!opts) return;

   if (!reset_mathjax) {
      if ((itemid>=0) || (itemid==-2)) {
         if (itemid==-2) itemid = -1; // special workaround for style entry, which is marked as itemid=-2
         if (++itemid>=opts[optid].items.length) itemid = -1;
      }

      if (itemid < 0) { // first check that all items are processed
         if (theOnlyOptionId == optid) {
            keyid = null;
            return processNextOption();
         }
         if (++optid >= opts.length) {
            optid = -1;
            let found = false, next = null;
            for (let key in examples_main) {
               // if (key === "TGeo") continue; // skip already here
               if (found) { next = key; break; }
               if (key == keyid) found = true;
            }

            keyid = next;
            if (theonlykey) keyid = null;
            return processNextOption();
         }
      }
   }

   entry = opts[optid];

   if ((theOnlyOptionId >= 0) && !entry.file && !entry.json && !entry.url) {
      let rid = optid;
      while (--rid >= 0) {
         let sentry = opts[rid];
         if (sentry.file && sentry.item) {
            entry.file = sentry.file; entry.item = sentry.item; break;
         }
      }
   }

   entry_name = "";

   // exclude some entries from the test
   if (entry.notest) return processNextOption();

   if (((entry.latex === "mathjax") || entry.reset_mathjax) && !reset_mathjax)
      return loadMathjax().then(() => {
         MathJax.startup.defaultReady();
         console.log('Loading MathJax and doing extra reset!!!')
         processNextOption(true);
      });

   let filename = "", itemname = "", jsonname = "", url = "", opt = "", opt2 = "",
       filepath = "http://jsroot.gsi.de/files/";
//       filepath = "https://root.cern.ch/js/files/";

   if (entry.file) {
       filename = entry.file;
       if ((filename.indexOf("http:") < 0) &&
           (filename.indexOf("https:") < 0) &&
           (filename.indexOf("file:") < 0)) filename = filepath + filename;
   }
   if (entry.item)
      itemname = entry.item;

   if (entry.testopt !== undefined)
      opt = entry.testopt;
   else if (entry.opt)
      opt = entry.opt;

   if (entry.json) {
      jsonname = entry.json;
      if ((jsonname.indexOf("http:")<0) && (jsonname.indexOf("https:")<0)) jsonname = filepath + jsonname;
   }
   if (entry.items) {
      if (itemid < 0) {
         if ((itemid==-1) && entry.style) {
            itemid = -2;
            itemname = entry.style; // special case when style should be applied before objects drawing
         } else {
           itemid = 0;
         }
      }
      if (itemid >= 0) {
         itemname = entry.items[itemid];
         if (entry.opts && (itemid < entry.opts.length)) opt = entry.opts[itemid];
      }
   }

   if (entry.r3d) opt2 = (opt ? "," : "") + "r3d_" + entry.r3d;

   if (entry.url)
      url = entry.url.replace(/\$\$\$/g, filepath);
   else if (entry.asurl) {
      url = ((entry.asurl === "browser") ? "?" : "?nobrowser&");
      url += jsonname ? "json=" + jsonname : "file=" + filename + "&item=" + itemname;
      if (keyid === "TTree") {
         if ((opt.indexOf(">>") < 0) && (opt.indexOf("dump") < 0) && (opt.indexOf("testio") < 0))
            opt += ">>dump;num:10";
      }
      url += "&opt=" + opt + opt2;
   }

   // if ((opt=='inspect') || (opt=='count')) return processNextOption();

   if (itemid >= 0)
      entry_name = (entry.name || keyid) + "_" + itemname + (opt ? "_" + opt : "");
   else if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt ? opt : keyid;

   if (theOnlyOption) {
      if (entry_name != theOnlyOption) return processNextOption();
      console.log('Select option', entry);
   }

   ProduceGlobalStyleCopy();
   if (!entry.style && init_style)
      Object.assign(gStyle, init_style);

   settings.Palette = init_palette;

   // ensure default options
   createRootColors(); // ensure default colors
   settings.Latex = 2;
   if (entry.latex) settings.Latex = constants.Latex.fromString(entry.latex);
   // seedrandom('hello.', { global: true }); // set global random
   internals.id_counter = 1; // used in some custom styles

   if (url.length > 0) {
      testfile = testobj = null;
      return ProcessURL(url);
   } else if (jsonname.length > 0) {
      testfile = testobj = null;
      httpRequest(jsonname, 'object').then(obj => {
         testobj = obj;
         ProduceSVG(testobj, opt+opt2);
      });
   } else if (filename.length > 0) {
      openFile(filename).then(file => {
         testfile = file;
         return testfile.readObject(itemname);
      }).then(obj => {
         if (itemid==-2) {
            // special handling of style
            // Check that copy of gStyle exists
            ProduceGlobalStyleCopy();
            // first create copy of existing style
            // then apply changes to the
            Object.assign(gStyle, obj);
            return processNextOption();
         } else {
            testobj = obj;
            ProduceSVG(testobj, opt+opt2);
         }
      });
   } else if (itemname.length > 0) {
      testfile.readObject(itemname).then(obj => {
         testobj = obj;
         ProduceSVG(testobj, opt+opt2);
      });
   } else {
      ProduceSVG(testobj, opt+opt2);
   }
}

processNextOption();
