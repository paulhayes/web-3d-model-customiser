const getParameterDefinitions = require('@jscad/core/parameters/getParameterDefinitions');
const getParameterValues = require('@jscad/core/parameters/getParameterValuesFromUIControls');
const { rebuildSolids, rebuildSolidsInWorker } = require('@jscad/core/code-evaluation/rebuildSolids');
const { mergeSolids } = require('@jscad/core/utils/mergeSolids');
const { formats, supportedFormatsForObjects } = require('@jscad/core/io/formats');
const { convertToBlob } = require('@jscad/core/io/convertToBlob');
const { CSG, CAG } = require('@jscad/csg');

// output handling
const { outputFile } = require('./output-file');
const Viewer = require('./jscad-viewer-lightgl');
const initZPad = require('./zpad');
const work = require('webworkify');

var modelConfig = {
  name:"single", 
  modelName:"PrusaHeadBandRC3", 
  quality : "low",
  materialType:"PETG",
  count:1, 
  model:null,
  extrasModel:null,
  addDate:true,
  addMaterial:true, 
  addMouseEars:false
}; //"PrusaShield RC3 x1";
//var modelName = 'PrusaShieldRC3';  // or PrusaShieldRC3_4Stack
//var stackCount = 1; // or 4
var buildOutput;
var downloadButton;
var materialTypeDropdown;
var quantityField;
var dateDropdown;
var addDateCheckbox; 
var nameField;
var viewer;
var needsUpdate;
var updatingModel;
var cancelUpdate;
var lastInput;
var updateOverlayNodes;
var updateOverlayMessage;
var updateOverlayProgress;
var selectedDate = new Date();
const inputTimeout = 200;



function init(){
  initZPad();

  downloadButton = document.getElementById('download-button');
  nameField = document.getElementById("name-field");
  updateOverlayNodes = document.getElementsByClassName("update-overlay");
  updateOverlayMessage = document.querySelector(".update-overlay .update-message");
  updateOverlayProgress =  document.querySelector(".update-overlay .update-progress");
  materialTypeDropdown = document.getElementById("material-type");  
  quantityField = document.getElementById("stack-count");
  dateDropdown = document.getElementById("selected-date");
  addDateCheckbox = document.getElementById("add-date"); 
  addMaterialCheckbox = document.getElementById("add-material"); 
  addMouseEarsCheckbox = document.getElementById("add-mouse-ears"); 
  qualityDropdown = document.getElementById("selected-quality");
  //init 3d model viewer
  var containerdiv = document.getElementById('viewerContainer');
  var viewerdiv = document.createElement('div');
  viewerdiv.className = 'viewer'
  viewerdiv.style.width = '100%'
  viewerdiv.style.height = '100%'
  containerdiv.appendChild(viewerdiv);
  viewer = new Viewer(viewerdiv,{
   // 3jscad-viewer-lightgl.js:298 {"position":{"x":16.850816779459187,"y":10.79013653116062,"z":192.0986346883937},"angle":{"x":-67.79999999999998,"y":1.6000000000000003,"z":65}}
    camera:{"position":{"x":16,"y":11,"z":192},"angle":{"x":-68,"y":1.6,"z":65}},
    plate:{
      draw:false,
    },
    axis:{
      draw:false
    } 
  });
  viewer.init();


  /* init model dropdown */
  reloadModel(); 
    
  

  quantityField.onchange = function(){
    modelConfig.count = parseInt( quantityField.value );
    updateModel();  
  }
  addDateCheckbox.onchange = function(){
    modelConfig.addDate = addDateCheckbox.checked;
    dateDropdown.disabled = !addDateCheckbox.checked;
    updateModel();  
  }
  addMaterialCheckbox.onchange = function(){
    modelConfig.addMaterial = addMaterialCheckbox.checked;
    materialTypeDropdown.disabled = !addMaterialCheckbox.checked;
    updateModel();  
  }
  addMouseEarsCheckbox.onchange = function(){
    modelConfig.addMouseEars = addMouseEarsCheckbox.checked;
    updateModel();  
  }
  qualityDropdown.onchange = function(){
    console.log("qualityDropdown.onchange"); 
    modelConfig.quality = qualityDropdown.value; 
    //modelConfig.modelFile = `models/${modelConfig.model}.jscad`;
    reloadModel(); 
    updateModel();  
  }
  /* init material dropdown */
  materialTypeDropdown.onchange = function(){ 
    modelConfig.materialType = materialTypeDropdown.value; 
    lastInput=Date.now()-inputTimeout; 
  };

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
    let generateFileWorker = work(require("./file-generator"));
    generateFileWorker.addEventListener("message",onMessageFromFileWorker);
    generateFileWorker.postMessage({cmd:"generate-stl",objects:buildOutput[0].toCompactBinary()});
    
  });


}



function reloadModel() { 

  modelConfig.modelFile = `models/${modelConfig.modelName}_${modelConfig.quality}.stl`;
  let loadFileWorker = work(require("./file-loader"));
  loadFileWorker.addEventListener("message",onMessageFromFileLoader);
  loadFileWorker.postMessage({cmd:"load-stl",name:"model",url:new URL(modelConfig.modelFile, window.location.origin).toString()});
  /*
  fetch(modelConfig.modelFile).then(function(response){

    if(response.ok){
      response.text().then(function(val){
        modelConfig.modelJSCad = val;
        updateModel();

      });
      
    }else {
      console.error(response.statusText);
    }
  });
  */

  if(modelConfig.extrasModel == null) { 

    console.log("loading extras");
    fetch('models/extras.jscad').then(function(response){

      if(response.ok){
        response.text().then(function(val){
          modelConfig.extrasModel = val;
          updateModel();
        
        });
        
      } else {
        console.error(response.statusText);
      }
    });

  }

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
  updateOverlayMessage.innerText = "Creating 3d model file";
  updateOverlayProgress.value = 0;
  Array.prototype.forEach.call(updateOverlayNodes,(n)=>{ n.style.visibility = "visible" });
}

function onSaveComplete(){
  downloadButton.disabled = false;  
  Array.prototype.forEach.call(updateOverlayNodes,(n)=>{ n.style.visibility = "hidden" });
}

function onModelBuildStart(){
  downloadButton.disabled = true;
  Array.prototype.forEach.call(updateOverlayNodes,(n)=>{ n.style.visibility = "visible" });
  updateOverlayMessage.innerText = "Updating Model";
  updateOverlayProgress.removeAttribute("value");
}

function onModelBuildComplete(){
  Array.prototype.forEach.call(updateOverlayNodes,(n)=>{ n.style.visibility = "hidden" });
  /*
  for (i = 0; i < updateOverlayNodes.length; i++) {
    updateOverlayNodes[i].style.visibility = "hidden";
  }
  */
  downloadButton.disabled = false;  
  viewer.viewpointY = 11 - ((modelConfig.count*20.25)*0.5); 
  viewer.onDraw();

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


const updateModel = function(){
  if(!modelConfig.model){
    console.error("can't update no model file");
    return;
  }
  if(updatingModel){
    
    if(cancelUpdate){
      cancelUpdate();
      cancelUpdate = null;
    }
    else {
      needsUpdate = true;
      return;      
    }
  }
  console.log("updating model");
  updatingModel = true;
  onModelBuildStart();
  //const parameters = getParameterValues(this.paramControls)
  let name = modelConfig.name = nameField.value;
  let dateStr = modelConfig.dateStr = dateString(selectedDate);
  let labellefttext = ""; 
  if(modelConfig.addMaterial) labellefttext = modelConfig.materialType+" ";
  if(modelConfig.addDate) labellefttext = labellefttext + dateStr;  
  modelConfig.labellefttext = labellefttext;
  //if(name == "") name = "."; 
  
  
  
  let script = `
function main(params) { 
    console.log(params.model);
    let shield = cube([100,100,100]); //params.model; 
    console.log(shield);
    shield = params.model;
    let count = ${modelConfig.count}; 
    let name = "${name}";
    let labellefttext = "${labellefttext}";
    let labeloutlines1 = vector_text(0,0,labellefttext);
    let labelextruded1 = [];
    let labeloutlines2 = vector_text(0,0,name);
    let labelextruded2 = [];
    let adddate = ${modelConfig.addDate}; 
    let addmaterial = ${modelConfig.addMaterial}; 
    let addmouseears = ${modelConfig.addMouseEars};
    
    let depth=0.75;
    let xpos = 87.6-depth; 
    let yposleft = -38;//-4; 
    let yposright = -39; 
    let zpos = -2; 
    let textscaleY = 0.19; 
    let textscaleX = 0.15; 

    labeloutlines1.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded1.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });
    labeloutlines2.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded2.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });
    let labelobject1 = union(labelextruded1);
    let labelobject2 = union(labelextruded2);
    let objectheight = 20.25; 
    
    let z = zpos + objectheight/2; 
    let leftbounds = labelobject1.scale([textscaleX,textscaleY,1]).getBounds(); 
    let labelsleft = (labelobject1.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(-90).translate([-xpos,yposleft+leftbounds[1].x,z]));
    let labelsright = (labelobject2.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(90).translate([xpos,yposright,z]));

    let subtractobject = cube(0); // is there a better way to create an empty object? 
    let issubtractobjectempty = true; 
    if(name!="") {
      subtractobject = subtractobject.union(labelsright); 
      issubtractobjectempty = false; 
    }
    if(labellefttext!="") {
      subtractobject = subtractobject.union(labelsleft); 
      issubtractobjectempty = false; 
    }

    if(!issubtractobjectempty) {
      shield = shield.subtract(subtractobject); 
    }

    let shields = []; 
    for(i = 0; i<count; i++) { 
        shields.push(shield.translate([0,0,i*objectheight]));
        if(i>0) {
            shields.push(supports().translate([0,0,objectheight*(i-1)]));
        }
        
    }
    if(count>1) shields.push(feet());
    if(addmouseears) shields.push(mouseEars());
    return union(shields);
    
}


function centrePoly(poly) { 
    let bounds = poly.getBounds(); 
    let centre = bounds[1].plus(bounds[0]).scale(-0.5);
    return poly.translate([centre.x, centre.y, centre.z]);
}
   `;

   /*
   cancelUpdate = rebuildSolids(script+modelConfig.extrasJSCad,"",{ model:modelConfig.modelJSCad },function(err,output){
    console.log("rebuild complete");
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
    cancelUpdate = null;
    console.log("model update complete");
    onModelBuildComplete();
  },{memFs:true}).cancel;
  */
  console.log("rendering");
  buildOutput = require('./render-visor')(modelConfig);

  viewer.setCsg(mergeSolids(buildOutput));
  if(needsUpdate) {
    needsUpdate = false;
    setTimeout(function(){
      updateModel();
    });
  }
  updatingModel = false;
  cancelUpdate = null;
  console.log("model update complete");
  onModelBuildComplete();
  
}

const onMessageFromFileLoader = function(evt){
  console.log(`Received ${evt.data.cmd} message from File loader`)

  if(evt.data.cmd === "status"){
  }
  else if( evt.data.cmd === "complete" ){
    modelConfig[evt.data.name] = CSG.fromCompactBinary( evt.data.data );
    updateModel();
  }
  else {
    console.error(`unknown worker message ${evt.data.cmd}`);
  }
}

const onMessageFromFileWorker = function(evt){
  if(evt.data.cmd === "status"){
    onFileProgress(evt);
  }
  else if( evt.data.cmd === "complete" ){
    onFileCreated(evt);
  }
  else {
    console.error(`unknown worker message ${evt.data.cmd}`);
  }
}

const onFileProgress = function(evt){
  //console.log(evt.data);
  updateOverlayProgress.value = evt.data.progress;
}

const onFileCreated = function(evt){
  let onDone = function(data, downloadAttribute, blobMode, noData) {
    hasOutputFile = true;
    //let outputFile = { data, downloadAttribute, blobMode, noData };
    saveFile(data,`${modelConfig.modelName}-x${modelConfig.count}-${dateStringFullYear(selectedDate)}.stl`);
    onSaveComplete();
  }
  let { fileData, ext } = evt.data;
  console.log(evt.data);
  fileData = convertToBlob(fileData);
 
  console.log("returned file is blob?",fileData instanceof Blob);
  outputFile(ext, fileData, onDone, null);  
}

const saveFile = (function () {
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



document.addEventListener('DOMContentLoaded', function (event) {
  init();
});