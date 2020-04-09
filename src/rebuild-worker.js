const { CSG } = require("@jscad/csg");
const main = require('./build-visor');

const uncompactModels = function (models){
  for(var key in models){
    var value = models[key];
    if(typeof(value)==='object' && value.class === 'CSG'){
      models[key] = CSG.fromCompactBinary(value);
    }
  }
  return models;
}


module.exports = function(self){
  self.addEventListener("message",function(evt){
      let cmd = evt.data.cmd;
      
      if(cmd === "build"){
        let modelConfig = uncompactModels(evt.data.modelConfig);
        let statusCallback = function(data){
          data.cmd = "status";
          self.postMessage(data);
        }
        modelConfig.statusCallback = statusCallback;
        let buildOutput = main(modelConfig);  
        console.log("build complete");      
        self.postMessage({"cmd":"complete", "data":buildOutput.toCompactBinary()});          
      }
  });
}