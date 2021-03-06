// this is just for speical testing of single object

let jsroot = require("jsroot");
let fs = require("fs");

let filename = "https://jsroot.gsi.de/files/histpainter6.root",
    itemname = "draw_contlst1";

function TestEve() {

   jsroot.httpRequest("https://jsroot.gsi.de/files/geom/evegeoshape.json.gz", "object")
         .then(obj => jsroot.makeSVG({ object: obj, width: 1200, height: 800 }))
         .then(svg => {
            fs.writeFileSync("eve.svg", svg);
            console.log('create eve.svg file size', svg.length);
          });

}

function TestHist() {

   jsroot.openFile(filename)
         .then(file => file.readObject(itemname))
         .then(obj => jsroot.makeSVG( { object: obj, width: 1200, height: 800 }))
         .then(svg => {
            fs.writeFileSync("hist.svg", svg);
            console.log('create hist.svg file size', svg.length);
         });
}

TestEve();
TestHist();
