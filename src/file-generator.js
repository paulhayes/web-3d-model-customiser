
/* this was using the serializer through the io lib, however that calls checkManifold which appears slow and broken at the moment ( it doesn't acutally catch all manifold errors ) */
//const {stlSerializer} = require('@jscad/io')
const stlSerializer = require('./CSGToStlb'); //originally @jscad/stl-serializer/CSGToStlb but copied out due to needing bug fix and changes 
const { CSG, CAG } = require('@jscad/csg');
const {mergeSolids2} = require('@jscad/core/utils/mergeSolids');

function generateStl(buildOutput, onStatus) {
    console.log('generating file');
    let outputFormat = {
      displayName: 'STL (Binary)',
      description: 'STereoLithography, Binary',
      extension: 'stl',
      mimetype: 'application/sla',
      convertCSG: true,
      convertCAG: false
    };

    console.log(`merging ${buildOutput.length} solids`,buildOutput);
    const object = (buildOutput.length==1) ? buildOutput[0] : mergeSolids2(buildOutput, outputFormat);
    console.log('merging complete');
    const options = {
      statusCallback: onStatus
    };

    console.log("serialising file");
    const data  = stlSerializer.serialize(object,options);
    const mimeType = outputFormat.mimeType
    return {data, mimeType};
  }

module.exports = function(self){
    self.addEventListener("message",function(evt){
        let cmd = evt.data.cmd;
        if(cmd === "generate-stl"){
            let buildOutput = [CSG.fromCompactBinary(evt.data.objects)];
            console.log(buildOutput);
            let onStatus = function(data){
              self.postMessage({"cmd":"status","progress":data.progress});
            }
            let fileData = generateStl(buildOutput,onStatus);
            console.log(fileData);
            console.log("meep! is output file blob?",fileData instanceof Blob);
            self.postMessage({"cmd":"complete", fileData,"ext":"stl"});
        }
    });
}