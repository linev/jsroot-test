var jsroot = require("jsroot");
var fs = require("fs");
//require("/home/linev/git/jsroot/demo/examples.js");
require("./../jsroot/demo/examples.js");

console.log('JSROOT version', jsroot.version);

console.log('examples', typeof examples_main);

var keyid = 'TH1', optid = -1, entry_name = "", testfile = null, testobj = null; // it is always first key 


function ProduceSVG(obj, opt) {
   jsroot.MakeSVG( { object: obj, option: opt, width: 1200, height: 800 }, function(svg) {
   
      if (!entry_name) entry_name = keyid;
      
      entry_name = entry_name.replace(/\+/g,'p');

      if (fs.accessSync(keyid)) fs.mkdirSync(keyid);
      
      
      var svgname = keyid + "/" + entry_name + ".svg";
      
      var svg0 = fs.readFileSync(svgname, 'utf-8'), result = "NEW";
      
      if (svg0 && svg0==svg) result = "MATCH"; else
      if (svg0 && svg0!=svg) result = "DIFF";
      
      console.log(keyid, entry_name, 'result', result, 'len', svg.length);
      
      if (result === "NEW")
         fs.writeFileSync(svgname, svg);

      ProcessNextOption();
   });
}


function ProcessNextOption() {

   if (!keyid) {
      console.log('No more data to process');
      return;
   }
   
   var opts = examples_main[keyid];
   if (!opts) return;
   
   if (++optid>=opts.length) {
      optid = -1;
      var found = false, next = null;
      for (var key in examples_main) {
          if (found) { next = key; break; }
          if (key == keyid) found = true;
      }
      
      keyid = null;
      console.log('enough');
      
      // keyid = next;
      return ProcessNextOption();
   }
   
   var entry = opts[optid];
   
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
   
   if (entry.url) url = entry.url.replace(/\$\$\$/g, filepath); else
   if (entry.asurl) {
      url = ((entry.asurl === "browser") ? "?" : "?nobrowser&");
      url += jsonname ? "json=" + jsonname : "file=" + filename + "&item=" + itemname;
      url += itemname + "&opt=" + opt;
   }
   
   if (opt=='inspect') return ProcessNextOption();

   if ('name' in entry)
      entry_name = entry.name;
   else
      entry_name = opt ? opt : keyid;
   
   if (url.length > 0) {   
      testfile = testobj = null;
      
      console.log('Ignore url', url);
      return ProcessNextOption();
      
   } else   
   if (jsonname.length > 0) {
      testfile = testobj = null;
      
      console.log('Ignore JSON', jsonname);
      return ProcessNextOption();
      
      //JSROOT.NewHttpRequest(jsonname, 'object', function(obj) {
      //   testobj = obj;
      //   JSROOT.draw("viewer", obj, opt, RunBigTest);
      //}).send();
   } else  
   if (filename.length > 0) {
       jsroot.OpenFile(filename, function(file) {
          testfile = file;
          testfile.ReadObject(itemname, function(obj) {
             testobj = obj;
             ProduceSVG(testobj, opt);
          });
       });
   } else
   if (itemname.length > 0) {
       testfile.ReadObject(itemname, function(obj) {
          testobj = obj;
          ProduceSVG(testobj, opt);
       });
   } else {
      ProduceSVG(testobj, opt);
   }
}

ProcessNextOption();