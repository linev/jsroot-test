// this is just for speical testing of single object

let jsroot = require("jsroot");
let fs = require("fs");

let filename = "file://hsimple.root", itemname = "hpxpy";

jsroot.openFile(filename)
      .then(file => file.readObject(itemname))
      .then(obj => jsroot.makeSVG( { object: obj, width: 1200, height: 800, option: "lego2" }))
      .then(svg => {
            fs.writeFileSync("lego.svg", svg);
            console.log('create lego.svg file size', svg.length);
         });
