
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
  quality : "high",
  materialType:"PETG",
  count:1, 
  model:null,
  extrasModelsLoaded:null,
  addDate:true,
  addMaterial:true, 
  addMouseEars:false
}; 

var buildOutput;
var downloadButton;
var materialTypeDropdown;
var quantityField;
var dateDropdown;
var addDateCheckbox; 
var nameField;
var viewer;
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
    generateFileWorker.postMessage({cmd:"generate-stl",objects:buildOutput.toCompactBinary()});
    
  });

}

function reloadModel() { 

  modelConfig.modelFile = `models/${modelConfig.modelName}_${modelConfig.quality}.stl`;
  let loadFileWorker = work(require("./file-loader"));
  loadFileWorker.addEventListener("message",onMessageFromFileLoader);
  loadFileWorker.postMessage({cmd:"load-stl",name:"model",url:new URL(modelConfig.modelFile, window.location.origin).toString()});
  
  if(!modelConfig.extrasModelsLoadedl) { 
    //console.log("loading extras");      
    loadFileWorker.postMessage({cmd:"load-stl",name:"feet",url:new URL("models/Feet.stl", window.location.origin).toString()});
    loadFileWorker.postMessage({cmd:"load-stl",name:"supports",url:new URL("models/Supports.stl", window.location.origin).toString()});
    loadFileWorker.postMessage({cmd:"load-stl",name:"mouseEars",url:new URL("models/mouseEars.stl", window.location.origin).toString()});  
    loadFileWorker.postMessage({cmd:"load-stl",name:"cutOuts",url:new URL("models/Cutouts.stl", window.location.origin).toString()});  
    modelConfig.extrasModelsLoaded = true;
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
  const modelNames = ["model","feet","supports","mouseEars"];
  
  if( !modelNames.every(name=>!!modelConfig[name]) ){
    return;
  }
  if(updatingModel){
    if(cancelUpdate){
      if(typeof(cancelUpdate)!=="function")
        console.log("unexpected type for cancelUpdate",typeof(cancelUpdate));
      cancelUpdate();
      cancelUpdate = null;
    }
    else {
      return;      
    }
  }
  console.log("updating model");
  updatingModel = true;
  onModelBuildStart();
  //const parameters = getParameterValues(this.paramControls)
  modelConfig.name = nameField.value;
  let dateStr = dateString(selectedDate);
  let labellefttext = ""; 
  if(modelConfig.addMaterial) labellefttext = modelConfig.materialType+" ";
  if(modelConfig.addDate) labellefttext = labellefttext + dateStr;  
  modelConfig.labellefttext = labellefttext;
  
  let buildWorker = work(require("./rebuild-worker"));
  buildWorker.addEventListener("message",onMessageFromBuilder);
  buildWorker.postMessage({cmd:"build",name:"model",modelConfig});
  cancelUpdate  = ()=>buildWorker.terminate();

}

const onMessageFromFileLoader = function(evt){  
  if(evt.data.cmd === "status"){
  }
  else if( evt.data.cmd === "complete" ){
    // no need to uncompact, going staight to another worker
    //modelConfig[evt.data.name] =  CSG.fromCompactBinary( evt.data.data );
    modelConfig[evt.data.name] = evt.data.data ;
    updateModel();
  }
  else {
    console.error(`unknown worker message ${evt.data.cmd}`);
  }
}

const onMessageFromFileWorker = function(evt){
  
  if(evt.data.cmd === "status"){
    onProgress(evt);
  }
  else if( evt.data.cmd === "complete" ){
    onFileCreated(evt);
  }
  else {
    console.error(`unknown worker message ${evt.data.cmd}`);
  }
}

const onProgress = function(evt){
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

const onMessageFromBuilder = function(evt){
  let cmd = evt.data.cmd;
  if(cmd === "status"){
    onProgress(evt);
  }
  else if(cmd === "complete"){
    buildOutput = CSG.fromCompactBinary( evt.data.data );
    //doesn't need to mergeSolids, union is called at the end anyway
    //viewer.setCsg(mergeSolids(buildOutput));
    viewer.setCsg(buildOutput);
    
    updatingModel = false;
    cancelUpdate = null;
    console.log("model update complete");
    onModelBuildComplete();
  }
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