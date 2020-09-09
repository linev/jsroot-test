// this is just for speical testing of single object 

var jsroot = require("jsroot");
var fs = require("fs");

var filename =  "http://jsroot.gsi.de/files/histpainter6.root",
    itemname = "draw_contlst1";

function MakeTest(file, item, callback) {
   file.ReadObject(item).then(obj => {
      jsroot.MakeSVG( { object: obj, width: 1200, height: 800 }, function(svg) {
         fs.writeFileSync(item + ".svg", svg);
         console.log('create ' + item + '.svg file size = ' + svg.length);
         if (callback) callback();
      });
   });
}

jsroot.OpenFile(filename).then(file => {
/*   MakeTest(file,"draw_hstack", function() {
      MakeTest(file,"draw_nostackb", function() {
         MakeTest(file,"draw_hstack", function() {
         });
      });
   });
   return;
*/   
   
   file.ReadObject(itemname).then(obj => {
      // var subpad = obj.fPrimitives.arr[2];
      // var subpad = obj;
      jsroot.MakeSVG( { object: obj, width: 1200, height: 800 }, function(svg) {
         fs.writeFileSync("single.svg", svg);
         console.log('create single.svg file size', svg.length);
      });
      
   });
});
