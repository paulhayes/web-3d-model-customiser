const { CSG } = require("@jscad/csg");
main = require('./build-visor')

function 

module.exports = function(self){
  self.addEventListener("message",function(evt){
      let cmd = evt.data.cmd;
      console.log(evt.data.url);
      if(cmd === "build"){
        buildOutput = main(modelConfig);        
        self.postMessage({"cmd":"complete", "data":buildOutput.toCompactBinary()});          
      }
  });
}