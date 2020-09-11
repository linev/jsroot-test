// this is just for speical testing of single object

var jsroot = require("jsroot");
var fs = require("fs");

var filename =  "http://jsroot.gsi.de/files/histpainter6.root",
    itemname = "draw_contlst1";

function TestEve() {
   jsroot.HttpRequest("http://jsroot.gsi.de/files/geom/evegeoshape.json.gz", "object").then(obj => {
      jsroot.MakeSVG({ object: obj, width: 1200, height: 800 }).then(svg => {
         fs.writeFileSync("eve.svg", svg);
         console.log('create eve.svg file size', svg.length);
      });
   });
}

function TestHist() {

   jsroot.OpenFile(filename).then(file => {

      file.ReadObject(itemname).then(obj => {
         jsroot.MakeSVG( { object: obj, width: 1200, height: 800 }).then(svg => {
            fs.writeFileSync("hist.svg", svg);
            console.log('create hist.svg file size', svg.length);
         });

      });
   });
}


TestEve();
TestHist();
