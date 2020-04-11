const { union } = require("@jscad/csg/src/api/ops-booleans");
const { rectangular_extrude } = require("@jscad/csg/src/api/ops-extrusions");
const { vector_text } = require("@jscad/csg/src/api/text");
const { CSG } = require("@jscad/csg/api").csg;

function main(params) { 
    if(params.statusCallback){
      params.statusCallback({progress:0});
    }
   
    let shield; 

    let count = params.count; 
    let name = params.name;

    let addmouseears = params.addMouseEars;
    
    let layerheight = params.layerHeight; 
    let objectheight = 20;
    let layercount = objectheight/layerheight; // + layerheight;
    if(layercount%1>0) { 
        layercount = Math.round(layercount); 
        objectheight = layercount*layerheight; 
    } 
    console.log("objectheight", objectheight);

    if(objectheight!=20) { 
       shield = params.model.scale([1,1,objectheight/20]);
    } else { 
       shield = params.model; 
    } 

    objectheight +=layerheight;

    console.log(params); 
    
    let cutouts = new CSG();
    if(params.cutOuts) cutouts = params.cutOuts.scale([1,1,(layerheight<0.4)?layerheight*2:layerheight]);
    
    let depth=0.75;
    let xpos = 87.6-depth; 
    let yposleft = -38;//-4; 
    let yposright = -39; 
    let zpos = -2; 
    let textscaleY = 0.19; 
    let textscaleX = 0.15; 

    // get outlines for the text and extrude them
    let labellefttext = params.labellefttext;
    let labeloutlines1 = vector_text(0,0,labellefttext);
    let labelextruded1 = [];
    
    labeloutlines1.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded1.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });

    let labeloutlines2 = vector_text(0,0,name);
    let labelextruded2 = [];

    labeloutlines2.forEach(function(pl) {                   // pl = polyline (not closed)
      labelextruded2.push(rectangular_extrude(pl, {w: 4, h: depth}));   // extrude it to 3D
    });

    if(params.statusCallback){
      params.statusCallback({progress:10});
    }

    // put the letter objects into a single CSG object
    let labelobject1 = union(labelextruded1);
    let labelobject2 = union(labelextruded2);
    
    // adjust the size and position of all the text
    let z = zpos + objectheight/2; 
    let leftbounds = labelobject1.scale([textscaleX,textscaleY,1]).getBounds(); 
    let labelsleft = (labelobject1.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(-90).translate([-xpos,yposleft+leftbounds[1].x,z]));
    let labelsright = (labelobject2.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(90).translate([xpos,yposright,z]));

    if(params.statusCallback){
      params.statusCallback({progress:10});
    }

    // now make a single object with all the text to subtract
    let subtractobject = new CSG(); 
   
    if(name!="") {
      subtractobject = subtractobject.union(labelsright); 
    }
    if(labellefttext!="") {
      subtractobject = subtractobject.union(labelsleft); 
    }

    // if we have something to subtract, then subtract it! 
    if(subtractobject.polygons.length>0) {
      shield = shield.subtract(subtractobject); 
    }

    if(params.statusCallback){
      params.statusCallback({progress:20});
    }

    let parts = [shield]; 

    let supports; 
    // subtract small recesses from the bottom of the stacked shields (to help with separation)
    if(count>1) { 
        shield = shield.subtract(cutouts); //.translate([0,0,objectheight*i])
        supports = params.supports.scale([1,1,objectheight/20.25]); 
    }
    
    for(var i = 1; i<count; i++) { 

        let shieldtranslated = (shield.translate([0,0,i*objectheight]));

        parts.push(shieldtranslated); 
        parts.push(supports.translate([0,0,objectheight*(i-1)]));                 
    }

    if(count>2) parts.push(params.feet);
    if(addmouseears) parts.push(params.mouseEars);

    let partsUnion = parts[0];
    //console.log(parts);
    for(var i=1;i<parts.length;i++){
      //console.log(i,parts[i]);
      partsUnion = partsUnion.union(parts[i]);
       
      //console.log("done");
      if(params.statusCallback){
        params.statusCallback({progress:20+70*i/parts.length});
      }  

    }

    //if(params.bottomRein

    if(params.statusCallback){
      params.statusCallback({progress:100});
    }

    return partsUnion;
    
}


function centrePoly(poly) { 
    let bounds = poly.getBounds(); 
    let centre = bounds[1].plus(bounds[0]).scale(-0.5);
    return poly.translate([centre.x, centre.y, centre.z]);
}
  

module.exports = main;