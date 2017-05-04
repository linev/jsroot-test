var jsroot = require("jsroot");
var fs = require("fs");
require("./../jsroot/demo/examples.js");

console.log('JSROOT version', jsroot.version);

var test_mode = "verify", nmatch = 0, ndiff = 0, nnew = 0,
    keyid = 'TH1', theonlykey = false, optid = -1, theonlyoption = -100, itemid = -1, 
    entry, entry_name = "", testfile = null, testobj = null;  


if (process.argv && (process.argv.length > 2)) {
   
   for (var cnt=2;cnt<process.argv.length;++cnt)
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
           theonlyoption = parseInt(process.argv[++cnt]);
           if (isNaN(theonlyoption) || (theonlyoption<0) || !examples_main[keyid][theonlyoption])
              return console.log('wrong options for key', theonlyoption);
           
           console.log('Select option', theonlyoption);
           break; 
        default:
           console.log('Usage: node test.js [-v|-c|-k keyname]');
           return;
      }
} 


function ProduceSVG(obj, opt) {

   // use only for object reading
   if ((theonlyoption>=0) && theonlyoption!==optid)
      return ProcessNextOption();
   
   jsroot.MakeSVG( { object: obj, option: opt, width: 1200, height: 800 }, function(svg) {
   
      if (!entry_name) entry_name = keyid;
      
      entry_name = entry_name.replace(/\+/g,'p');
      
      fs.access(keyid, fs.constants.W_OK, function(dir_err) {
         
         if (dir_err) fs.mkdirSync(keyid);
         
         var svgname = keyid + "/" + entry_name + ".svg",
             svg0 = null, result = "MATCH";
         
         try {
           svg0 = fs.readFileSync(svgname, 'utf-8');
           if (svg0!=svg) result = "DIFF";
         } catch(e) {
           svg0 = null;
           result = "NEW"; 
         }
         
         switch (result) {
            case "NEW": nnew++; break;
            case "DIFF": if (!entry.random) ndiff++; break;
            default: nmatch++;
         }

         console.log(keyid, entry_name, 'result', result, 'len='+svg.length, (svg0 && result=='DIFF' ? 'rel0='+(svg.length/svg0.length*100).toFixed(1)+'\%' : ''));

         if ((result === "NEW") || ((test_mode === 'create') && (result!=='MATCH')))
            fs.writeFileSync(svgname, svg);

         ProcessNextOption();

      }); 
      
   });
}


function ProcessNextOption() {

   if (!keyid) {
      console.log('No more data to process');
      console.log("SUMMARY: match", nmatch, "diff", ndiff, "new", nnew);
      return;
   }
   
   var opts = examples_main[keyid];
   if (!opts) return;
   
   if (itemid>=0) {
      if (++itemid>=opts[optid].items.length) itemid = -1;
   }
   
   if (itemid<0) { // first check that all items are processed
      if (theonlyoption == optid) {
         keyid = null;
         return ProcessNextOption();
      }
      if (++optid>=opts.length) {
         optid = -1;
         var found = false, next = null;
         for (var key in examples_main) {
            if (found) { next = key; break; }
            if (key == keyid) found = true;
         }

         keyid = next;
         if (keyid=="TTree") keyid = null; // just for debug purposes - stop with first key
         if (theonlykey) keyid = null;
         return ProcessNextOption();
      }
   }
   
   entry = opts[optid];
   
   entry_name = "";

   // exclude some entries from the test
   if (entry.notest) return ProcessNextOption();
   
   var filename = "", itemname = "", jsonname = "", url = "", opt = "",
       filepath = "http://jsroot.gsi.de/files/";
   
   if (entry.file) {
       filename = entry.file;
       if ((filename.indexOf("http:")<0) && (filename.indexOf("https:")<0)) filename = filepath + filename; 
   }
   if (entry.item) itemname = entry.item;
   if (entry.opt) opt = entry.opt;
   if (entry.json) {
      jsonname = entry.json;
      if ((jsonname.indexOf("http:")<0) && (jsonname.indexOf("https:")<0)) jsonname = filepath + jsonname;
   }
   if (entry.items) {
      if (itemid<0) itemid = 0;
      itemname = entry.items[itemid];
      if (entry.opts && (itemid < entry.opts.length)) opt = entry.opts[itemid]; 
   }
   
   if (entry.url) url = entry.url.replace(/\$\$\$/g, filepath); else
   if (entry.asurl) {
      url = ((entry.asurl === "browser") ? "?" : "?nobrowser&");
      url += jsonname ? "json=" + jsonname : "file=" + filename + "&item=" + itemname;
      url += itemname + "&opt=" + opt;
   }
   
   if (opt=='inspect') return ProcessNextOption();

   if (itemid >= 0)
      entry_name = (entry.name || keyid) + "_" + itemname + (opt ? "_" + opt : "");
   else
   if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt ? opt : keyid;
   
   if (url.length > 0) {   
      testfile = testobj = null;
      return ProcessNextOption();
   } else   
   if (jsonname.length > 0) {
      testfile = testobj = null;
      if (jsroot.Painter) jsroot.Painter.createRootColors(); // ensure default colors
      jsroot.NewHttpRequest(jsonname, 'object', function(obj) {
         testobj = obj;
         ProduceSVG(testobj, opt);
      }).send();
   } else  
   if (filename.length > 0) {
      if (jsroot.Painter) jsroot.Painter.createRootColors(); // ensure default colors
      jsroot.OpenFile(filename, function(file) {
         testfile = file;
         testfile.ReadObject(itemname, function(obj) {
            testobj = obj;
            ProduceSVG(testobj, opt);
         });
      });
   } else
   if (itemname.length > 0) {
      if (jsroot.Painter) jsroot.Painter.createRootColors(); // ensure default colors
      testfile.ReadObject(itemname, function(obj) {
         testobj = obj;
         ProduceSVG(testobj, opt);
      });
   } else {
      ProduceSVG(testobj, opt);
   }
}

ProcessNextOption();