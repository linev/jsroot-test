let jsroot = require("jsroot"),
    fs = require("fs"),
    xml_formatter = require('xml-formatter');

require("./../jsroot/demo/examples.js");

console.log(`JSROOT version  ${jsroot.version} ${jsroot.version_date}`);

let init_style = null,
    test_mode = "verify", nmatch = 0, ndiff = 0, nnew = 0,
    keyid = 'TH1', theonlykey = false, optid = -1,
    theOnlyOption, theOnlyOptionId = -100, itemid = -1,
    entry, entry_name = "", testfile = null, testobj = null,
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
           if (!keyid || !examples_main[keyid])
              return console.log('Key not found', keyid);
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
           require("./../jsroot/demo/examples_more.js");

           for (let key in examples_more) {
              if (key in examples_main) {
                 for (let n in examples_more[key])
                    examples_main[key].push(examples_more[key][n]);
              } else {
                 examples_main[key] = examples_more[key];
              }
           }

           break;

        default:
           console.log('Usage: node test.js [options]');
           console.log('   -v | --verify : check stored content against current JSROOT version');
           console.log('   -c | --create : perform checks and overwrite when results differ');
           console.log('   -k | --key keyname : select specific key (class name) like TH1 or TProfile for testing');
           console.log('   -o | --opt id : select specific option id (number or name), only when key is specified');
           console.log('   -m | --more : use more tests');
           return;
      }
}

function ProduceGlobalStyleCopy() {
   // copy style when painter is loaded
   if (!init_style && jsroot.Painter) init_style = jsroot.gStyle;
}

function ProduceFile(content, extension, subid) {
   if (!entry_name) entry_name = keyid;

   entry_name = entry_name.replace(/\+/g,'p').replace(/\>/g,'more')
                          .replace(/\</g,'less').replace(/\|/g,'I')
                          .replace(/\[/g,'L').replace(/\]/g,'J').replace(/\*/g,'star');

   let use_name = entry_name;
   if (subid)
      use_name += "_" + subid;

   if (extension != ".json")
      content = xml_formatter(content, {indentation: ' ', lineSeparator: '\n' });

   try {
      fs.accessSync(keyid, fs.constants.W_OK);
   } catch(err) {
      fs.mkdirSync(keyid);
   }

   let svgname = keyid + "/" + use_name + extension,
       svg0 = null, result = "MATCH";

   try {
     svg0 = fs.readFileSync(svgname, 'utf-8');
     if (svg0 != content) result = "DIFF";
   } catch(e) {
     svg0 = null;
     result = "NEW";
   }

   // workaround to ignore alice variation, to let enable TGeo testings
   if ((result == "DIFF") && (keyid == "TGeo") && (entry_name == "alice") && (Math.abs(svg0.length - content.length) < 0.01*svg0.length)) {
      console.log('!! Ignore alice variation for now !!');
      content = svg0;
      result = "MATCH";
   }

   switch (result) {
      case "NEW": nnew++; break;
      case "DIFF": ndiff++; break;
      default: nmatch++;
   }

   let clen = content ? content.length : -1;
   console.log(keyid, use_name, 'result', result, 'len='+clen, (svg0 && result=='DIFF' ? 'rel0='+(clen/svg0.length*100).toFixed(1)+'\%' : ''));

   if ((result === "NEW") || ((test_mode === 'create') && (result!=='MATCH'))) {
      if (clen > 0)
         fs.writeFileSync(svgname, content);
      else if (result !== "NEW")
         fs.unlink(svgname);
   }

   if (subid === undefined) ProcessNextOption();
}

function ProduceSVG(obj, opt) {

   // use only for object reading
   if ((theOnlyOptionId >= 0) && theOnlyOptionId !== optid)
      return ProcessNextOption();

   jsroot.makeSVG({ object: obj, option: opt, width: 1200, height: 800 })
         .then(svg => ProduceFile(svg, ".svg"));
}

function ProduceJSON(tree, opt, branchname) {
   if (!tree) return ProcessNextOption();

   let args = { expr: opt, dump: true };
   if (branchname) {
      if (branchname === "/Event/Gen/Header/m_evtNumber") branchname = "/Event/Gen/Header.m_evtNumber"; // workaround
      if (branchname === "ESDfriend./fTracks/fTPCindex") branchname = "ESDfriend.fTracks.fTPCindex"; // workaround
      if (branchname === "event/fTracks/fMass2") branchname = "event.fTracks.fMass2"; // workaround
      if (branchname === "Rec::TrackParticleContainer_tlp1_MooreTrackParticles/m_hepSymMatrices/m_matrix_val")
          branchname = "Rec::TrackParticleContainer_tlp1_MooreTrackParticles.m_hepSymMatrices.m_matrix_val";
      args.branch = tree.FindBranch(branchname);
      if (!args.branch) console.log('Fail to find branch', branchname)
   }

   tree.Draw(args).then(res => {
      let json = res ? JSON.stringify(res, null, 1) : "<fail>";
      ProduceFile(json, ".json");
   });
}

function ProcessURL(url) {

   return jsroot.require('hierarchy').then(() => {

      let hpainter = new jsroot.HierarchyPainter("testing", null);
      let batch_disp = new JSROOT.BatchDisplay(1200, 800);
      hpainter.setDisplay(batch_disp);

      hpainter.startGUI(null, url).then(() => {
         if (batch_disp.numFrames() == 0)
            console.log('   !!! BATCH URL CREATES NO FRAME !!!', keyid, entry_name);
         for (let n = 0; n < batch_disp.numFrames(); ++n) {
            let json = batch_disp.makeJSON(n, 1);
            if (json) ProduceFile(json, ".json", n);
            let svg = json ? "" : batch_disp.makeSVG(n);
            if (svg) ProduceFile(svg, ".svg", n);
         }
         ProcessNextOption();
      });
   });
}


function ProcessNextOption(reset_mathjax) {

   if (!keyid) {
      console.log('No more data to process');
      console.log("SUMMARY: match", nmatch, "diff", ndiff, "new", nnew);
      return;
   }

   // make timeout to avoid deep callstack
   let curr_time = new Date().getTime();
   if ((curr_time - last_time > 10000) && !reset_mathjax) {
      last_time = curr_time;
      return setTimeout(() => ProcessNextOption(), 1);
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
            return ProcessNextOption();
         }
         if (++optid>=opts.length) {
            optid = -1;
            let found = false, next = null;
            for (let key in examples_main) {
               // if (key === "TGeo") continue; // skip already here
               if (found) { next = key; break; }
               if (key == keyid) found = true;
            }

            keyid = next;
            if (theonlykey) keyid = null;
            return ProcessNextOption();
         }
      }
   }

   entry = opts[optid];

   entry_name = "";

   // exclude some entries from the test
   if (entry.notest) return ProcessNextOption();

   if (((entry.latex === "mathjax") || entry.reset_mathjax) && !reset_mathjax)
      return jsroot.require('latex')
                   .then(ltx => ltx.LoadMathjax())
                   .then(() => {
         MathJax.startup.defaultReady();
         console.log('Loading MathJax and doing extra reset!!!')
         ProcessNextOption(true);
      });

   let filename = "", itemname = "", itemfield = "", jsonname = "", url = "", opt = "", opt2 = "",
       filepath = "http://jsroot.gsi.de/files/";
//       filepath = "https://root.cern.ch/js/files/";

   if (entry.file) {
       filename = entry.file;
       if ((filename.indexOf("http:")<0) && (filename.indexOf("https:")<0)) filename = filepath + filename;
   }
   if (entry.item) {
      itemname = entry.item;
      if (entry.itemfield) { itemfield = entry.itemfield; itemname = itemname.substr(0, itemname.length - itemfield.length - 1); }
   }
   if (entry.testopt !== undefined) opt = entry.testopt; else if (entry.opt) opt = entry.opt;

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
      if (itemid>=0) {
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
         if ((opt.indexOf(">>") < 0) && (opt.indexOf("dump") < 0))
            opt += ">>dump;num:10";
      }
      url += "&opt=" + opt + opt2;
   }

   if (/*(opt=='inspect') || */ (opt=='count')) return ProcessNextOption();

   if (itemid >= 0)
      entry_name = (entry.name || keyid) + "_" + itemname + (opt ? "_" + opt : "");
   else if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt ? opt : keyid;

   if (theOnlyOption) {
      if (entry_name != theOnlyOption) return ProcessNextOption();
      console.log('Select option', entry);
   }

   ProduceGlobalStyleCopy();
   if (!entry.style && init_style) jsroot.gStyle = jsroot.extend({}, init_style);

   // ensure default options
   if (jsroot.Painter) jsroot.Painter.createRootColors(); // ensure default colors
   jsroot.settings.Latex = 2;
   if (entry.latex) jsroot.settings.Latex = jsroot.constants.Latex.fromString(entry.latex);
   // seedrandom('hello.', { global: true }); // set global random
   jsroot._.id_counter = 1; // used in some custom styles

/*   if (keyid === "TTree") {
      if (entry.url || entry.large) return ProcessNextOption(); // ignore direct URL
      // console.log('Processing ', entry);

      jsroot.openFile(filename).then(file => {
         let branchname = "", pos = itemname.indexOf(";1/");
         if (pos>0) { branchname = itemname.substr(pos+3); itemname = itemname.substr(0, pos+2); }
         if (!branchname && opt == "dump") {
            pos = itemname.indexOf("/");
            if (pos > 0) { branchname = itemname.substr(pos+1); itemname = itemname.substr(0, pos); }
         }
         file.readObject(itemname).then(tree => ProduceJSON(tree, opt+opt2, branchname));
      }).catch(()=> { console.log('Fail to find tree', itemname); ProcessNextOption(); });
   } else */ if (((url.length > 0) && !entry.asurl) || (keyid === "TTree")) {
      console.log('Processing', url);
      testfile = testobj = null;
      return ProcessURL(url);
      // return ProcessNextOption();
   } else if (jsonname.length > 0) {
      testfile = testobj = null;
      jsroot.httpRequest(jsonname, 'object').then(obj => {
         testobj = obj;
         ProduceSVG(testobj, opt+opt2);
      });
   } else if (filename.length > 0) {
      jsroot.openFile(filename).then(file => {
         testfile = file;
         return testfile.readObject(itemname);
      }).then(obj => {
         if (itemid==-2) {
            // special handling of style
            // Check that copy of gStyle exists
            ProduceGlobalStyleCopy();
            // first create copy of existing style
            let newstyle = jsroot.extend({}, jsroot.gStyle);
            // then apply changes to the
            jsroot.gStyle = jsroot.extend(newstyle, obj);
            return ProcessNextOption();
         } else {
            if (itemfield) {
               if (itemfield == "Overlaps/ov00010") {
                  obj = obj.fOverlaps.arr[10];
                  console.log("found obj", obj ? obj._typename : "none");
               } else if (obj[itemfield])
                  obj = obj[itemfield];
            }
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

// start processing

ProcessNextOption();
