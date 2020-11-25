// this is just for speical testing of single object

let jsroot = require("jsroot");
let fs = require("fs");

jsroot.openFile("http://jsroot.gsi.de/files/zstd.root")
      .then(file => file.readObject("ccdb_object"))
      .then(obj => jsroot.makeSVG({ object: obj, width: 1200, height: 800 }))
      .then(svg => fs.writeFileSync("hist.svg", svg));
