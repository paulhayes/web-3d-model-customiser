const { convertToBlob } = require('@jscad/core/io/convertToBlob')
const { prepareOutput } = require('@jscad/core/io/prepareOutput')


function generateStl(buildOutput) {
    console.log('generating file');
    let outputFormat = {
      displayName: 'STL (Binary)',
      description: 'STereoLithography, Binary',
      extension: 'stl',
      mimetype: 'application/sla',
      convertCSG: true,
      convertCAG: false
    };
    console.log(buildOutput);
    //const blob = convertToBlob(prepareOutput(buildOutput, { format: outputFormat.extension }));
  
    //return blob;
  }

module.exports = function(self){
    self.addEventListener("message",function(evt){
        let cmd = evt.data.cmd;
        if(cmd === "generate-stl"){
            let file = generateStl(evt.data.objects);
            //self.postMessage({"file":file,"ext":"stl"});
        }
    });
}