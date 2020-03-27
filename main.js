const getParameterDefinitions = require('@jscad/core/parameters/getParameterDefinitions')
const getParameterValues = require('@jscad/core/parameters/getParameterValuesFromUIControls')
const { rebuildSolids, rebuildSolidsInWorker } = require('@jscad/core/code-evaluation/rebuildSolids')
const { mergeSolids } = require('@jscad/core/utils/mergeSolids')

// output handling
//const { generateOutputFile } = require('../io/generateOutputFile')
const { prepareOutput } = require('@jscad/core/io/prepareOutput')
const { convertToBlob } = require('@jscad/core/io/convertToBlob')
const { formats, supportedFormatsForObjects } = require('@jscad/core/io/formats')
const { generateOutputFile } = require('./generateOutputFile.js');


let modelName = 'FaceShieldNoLogoRC3FromPrusaSlicer';  
var modelFile = `models/${modelName}.jscad`;
var modelJSCad;
var hasOutputFile = false;
var outputFile = null;
var buildOutput ;
var downloadButton

function init(){
  downloadButton = document.getElementById('download-button');
  Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
  }

  fetch(modelFile).then(function(response){
    if(response.ok){
      response.text().then(function(val){
        modelJSCad = val;
        updateModel();
      });
      
    }else {
      console.error(response.statusText);
    }
  });
  
  downloadButton.addEventListener('click',function(){
    setTimeout(function(){
      onSaveInProgress();
      updateModel();
      generateFile();  
    },50);
  });
}

function onSaveInProgress(){
  downloadButton.disabled = true;
}

function onSaveComplete(){
  downloadButton.disabled = false;  
}

function updateModel(){

  //const parameters = getParameterValues(this.paramControls)
  let name = document.getElementById("name-field").value;
  let material = document.getElementById("material-type").value;
  console.log({name,material});
  let now = new Date();
  let date = now.getDate().pad(2)+"."+(now.getMonth()+1).pad(2)+"."+now.getFullYear();
  let script = `function main(){
    var l = vector_text(0,0,"${name} \\n${material} ${date}");
    var o = [];
    var depth=1.2;
    l.forEach(function(pl) {                   // pl = polyline (not closed)
       o.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });
    let label = cube({size: 0, center:false}).union(union(o).scale([0.15,0.15,1])).rotateX(90).rotateZ(-90).translate([37+depth,95,10]);
    
    return ${modelName}().subtract(label);
  }
   `;

  rebuildSolids(script+modelJSCad,"",{},function(err,output){
    console.log(output);
    buildOutput = output;
  },{memFs:true});
  
}

var saveFile = (function () {
  var a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  return function (blobUrl, fileName) {
    console.log("saving");
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      setTimeout(function(){
        window.URL.revokeObjectURL(blobUrl);		        	
      });
  };
}());

function generateFile() {
  let objects = buildOutput;
  console.log('generating file');
  let outputFormat = {
    displayName: 'STL (Binary)',
    description: 'STereoLithography, Binary',
    extension: 'stl',
    mimetype: 'application/sla',
    convertCSG: true,
    convertCAG: false
  };
  const blob = convertToBlob(prepareOutput(objects, { format: outputFormat.extension }));

  function onDone(data, downloadAttribute, blobMode, noData) {
    hasOutputFile = true;
    outputFile = { data, downloadAttribute, blobMode, noData };
    saveFile(outputFile.data,"test.stl");
    onSaveComplete();
  }

  generateOutputFile("stl", blob, onDone, null);  
}

document.addEventListener('DOMContentLoaded', function (event) {
  init();
});