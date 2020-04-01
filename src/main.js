const getParameterDefinitions = require('@jscad/core/parameters/getParameterDefinitions')
const getParameterValues = require('@jscad/core/parameters/getParameterValuesFromUIControls')
const { rebuildSolids, rebuildSolidsInWorker } = require('@jscad/core/code-evaluation/rebuildSolids')
const { mergeSolids } = require('@jscad/core/utils/mergeSolids')

// output handling
//const { generateOutputFile } = require('../io/generateOutputFile')
const { prepareOutput } = require('@jscad/core/io/prepareOutput')
const { convertToBlob } = require('@jscad/core/io/convertToBlob')
const { formats, supportedFormatsForObjects } = require('@jscad/core/io/formats')
const { generateOutputFile } = require('./generateOutputFile');
const Viewer = require('./jscad-viewer-lightgl');


var modelName = 'PrusaShieldRC3';  // or PrusaShieldRC3_4Stack
var stackCount = 1; // or 4
var modelFile = `models/${modelName}.jscad`;
var modelJSCad;
var hasOutputFile = false;
var outputFile = null;
var buildOutput;
var downloadButton;
var materialTypeDropdown;
var nameField;
var viewer;
var needsUpdate;
var updatingModel;
var lastInput;
var updateModelMessageNodes;
const inputTimeout = 1000;

function init(){
  downloadButton = document.getElementById('download-button');
  nameField = document.getElementById("name-field");
  updateModelMessageNodes = document.getElementsByClassName("update-model");
  materialTypeDropdown = document.getElementById("material-type");
  //nameField.oninput = updateModel;
  nameField.oninput = function(){ lastInput=Date.now() };
  materialTypeDropdown.onchange = function(){ lastInput=Date.now()-inputTimeout };
  var containerdiv = document.getElementById('viewerContainer');
  var viewerdiv = document.createElement('div');
  viewerdiv.className = 'viewer'
  viewerdiv.style.width = '100%'
  viewerdiv.style.height = '100%'
  containerdiv.appendChild(viewerdiv);
  viewer = new Viewer(viewerdiv,{
    camera:{"position":{"x":-11.963978423799869,"y":30.454086159474876,"z":176.7626167126004},"angle":{"x":-64.79999999999998,"y":1.6000000000000003,"z":-59.39999999999999}},
    plate:{
      draw:false,
    },
    axis:{
      draw:false
    } 
  });

  setInterval(inputUpdateCheck,100);
  viewer.init();
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
    onSaveInProgress(); 
    setTimeout(function(){
           
      generateFile();  
    },50);
  });
}

function inputUpdateCheck(){
  if(lastInput){
    var elapsed = Date.now()-lastInput;
    if(elapsed>inputTimeout){
      lastInput = false;
      updateModel();
    }
  }
}

function onSaveInProgress(){
  downloadButton.disabled = true;
}

function onSaveComplete(){
  downloadButton.disabled = false;  
}

function onModelBuildStart(){
  downloadButton.disabled = true;
  for (i = 0; i < updateModelMessageNodes.length; i++) {
    updateModelMessageNodes[i].style.visibility = "visible";
  }
}

function onModelBuildComplete(){
  for (i = 0; i < updateModelMessageNodes.length; i++) {
    updateModelMessageNodes[i].style.visibility = "hidden";
  }
  downloadButton.disabled = false;  

}


function updateModel(){
  if(updatingModel){
    needsUpdate = true;
    return;
  }
  console.log("updating model");
  updatingModel = true;
  onModelBuildStart();
  //const parameters = getParameterValues(this.paramControls)
  let name = nameField.value;
  if(name =="") name = "."; 
  let material = materialTypeDropdown.value;
  console.log({name,material});
  let now = new Date();
  let date = now.getDate().pad(2)+"."+(now.getMonth()+1).pad(2)+"."+now.getFullYear().toString().substr(2, 2);


  let script = `
function main() { 
    let shield = (centrePoly(model())); 

    let count = ${stackCount}; 

    let labeloutlines1 = vector_text(0,0,"${material} ${date}");
    let labelextruded1 = [];
    let labeloutlines2 = vector_text(0,0,"${name}");
    let labelextruded2 = [];
    
    let depth=0.75;
    let xpos = 87.6-depth; 
    let yposleft = -14; 
    let yposright = -47; 
    let zpos = -1.5; 
    labeloutlines1.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded1.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });
    labeloutlines2.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded2.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });
    let labelobject1 = union(labelextruded1);
    let labelobject2 = union(labelextruded2);
    let objectheight = 20.25; 
    let zoffset = -(count-1)/2*objectheight; 
    let labelsleft =[]; 
    let labelsright =[]; 

    for ( i =0 ;i<count;i++ ){
      let z = zoffset + (i*objectheight) +zpos; 
      labelsleft.push(labelobject1.scale([0.15,0.15,1]).rotateX(90).rotateZ(-90).translate([-xpos,yposleft,z]));
      labelsright.push(labelobject2.scale([0.15,0.15,1]).rotateX(90).rotateZ(90).translate([xpos,yposright,z]));
    }
   return shield.subtract(labelsleft).subtract(labelsright); 
    
   
}

function centrePoly(poly) { 
    let bounds = poly.getBounds(); 
    let centre = bounds[1].plus(bounds[0]).scale(-0.5);
    return poly.translate([centre.x, centre.y, centre.z]);
}
   `;

  rebuildSolidsInWorker(script+modelJSCad,"",{},function(err,output){
    //console.log(script);
    if(err){
      console.error(err);
      return;
    }
    buildOutput = output;
    if(output) viewer.setCsg(mergeSolids(output));
    if(needsUpdate) {
      needsUpdate = false;
      setTimeout(function(){
        updateModel();
      });
    }
    updatingModel = false;
    console.log("model update complete");
    onModelBuildComplete();
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