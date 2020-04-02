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
const initZPad = require('./zpad');

var modelConfigurations = [
  {name:"single", model:"PrusaShieldRC3", count:1, modelJSCad:null}, //"PrusaShield RC3 x1"
  {name:"x4 stacked", model:"PrusaShieldRC3_4Stack", count:4, modelJSCad:null} //"PrusaShield RC3 x4"
];
var selectedModelIndex = 0;
//var modelName = 'PrusaShieldRC3';  // or PrusaShieldRC3_4Stack
//var stackCount = 1; // or 4
var outputFile = null;
var buildOutput;
var downloadButton;
var materialTypeDropdown;
var modelTypeDropdown;
var dateDropdown;
var nameField;
var viewer;
var needsUpdate;
var updatingModel;
var lastInput;
var updateModelMessageNodes;
var selectedDate = new Date();
const inputTimeout = 1000;



function init(){
  initZPad();

  downloadButton = document.getElementById('download-button');
  nameField = document.getElementById("name-field");
  updateModelMessageNodes = document.getElementsByClassName("update-model");
  materialTypeDropdown = document.getElementById("material-type");
  modelTypeDropdown = document.getElementById("model-type");
  dateDropdown = document.getElementById("selected-date");

  //init 3d model viewer
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
  viewer.init();


  /* init model dropdown */
  modelConfigurations.forEach(function(modelConfig,i){
    modelConfig.modelFile = `models/${modelConfig.model}.jscad`;
    fetch(modelConfig.modelFile).then(function(response){
      if(response.ok){
        response.text().then(function(val){
          modelConfig.modelJSCad = val;
          updateModel();
          let option = document.createElement("option");
          option.innerText = modelConfig.name;
          option.value = i;
          modelTypeDropdown.appendChild(option);
        });
        
      }else {
        console.error(response.statusText);
      }
    });
  });

  modelTypeDropdown.onchange = function(){
    selectedModelIndex = parseInt( modelTypeDropdown.value );
    updateModel();    
  }

  /* init material dropdown */
  materialTypeDropdown.onchange = function(){ lastInput=Date.now()-inputTimeout };



  /* init name field */
  nameField.oninput = function(){ lastInput=Date.now() };
  //input update check
  setInterval(inputUpdateCheck,100);
  

  /* init date dropdown */
  let days = ["today","+1 day","","","","","",""];
  days.forEach(function(text,offsetDays){
    if(text===""){
      text = `+${offsetDays} days`;
    }
    let option = document.createElement("option");
    let date = new Date( Date.now() + offsetDays*24*3600*1000 );    
    option.innerText = `${text} - ${dateString(date)}`;
    option.value = offsetDays;
    dateDropdown.appendChild(option);
  });
  dateDropdown.onchange = function(){
    let offsetDays = parseInt( dateDropdown.value ) || 0;
    selectedDate = new Date( Date.now() + offsetDays*24*3600*1000 ); 
    updateModel();
  };
 
  /* init download button */
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

function dateString(date){
  return date.getDate().pad(2)+"."+(date.getMonth()+1).pad(2)+"."+(date.getYear()-100).toString();
}

function dateStringBackwards(date){
  return date.getFullYear().toString()+"."+(date.getMonth()+1).pad(2)+"."+date.getDate().pad(2);
}

function dateStringFullYear(date){
  return date.getDate().pad(2)+"."+(date.getMonth()+1).pad(2)+"."+date.getFullYear().toString();
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
  
  let dateStr = dateString(selectedDate);
  let modelConfig = modelConfigurations[selectedModelIndex];
  let script = `
function main() { 
    let shield = (centrePoly(model())); 

    let count = ${modelConfig.count}; 

    let labeloutlines1 = vector_text(0,0,"${material} ${dateStr}");
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

  rebuildSolidsInWorker(script+modelConfig.modelJSCad,"",{},function(err,output){
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
    let modelConfig = modelConfigurations[selectedModelIndex];
    saveFile(outputFile.data,`${modelConfig.model}-${dateStringFullYear(selectedDate)}.stl`);
    onSaveComplete();
  }

  generateOutputFile("stl", blob, onDone, null);  
}

document.addEventListener('DOMContentLoaded', function (event) {
  init();
});