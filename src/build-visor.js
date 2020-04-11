const { union } = require("@jscad/csg/src/api/ops-booleans");
const { rectangular_extrude } = require("@jscad/csg/src/api/ops-extrusions");
const { vector_text } = require("@jscad/csg/src/api/text");
const { CSG } = require("@jscad/csg/api").csg;

function main(params) { 
    if(params.statusCallback){
      params.statusCallback({progress:0, message:"Preparing data"});
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
    
    let cutouts = params.cutOuts.scale([1,1,(layerheight<0.4)?layerheight*2:layerheight]);
    
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
      params.statusCallback({progress:10, message:"Calculating text indentations"});
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
      params.statusCallback({progress:20, message:"Creating shield template"});
    }

    let parts = [shield]; 
    let partsIntersecting = [];

    let supports; 
    // subtract small recesses from the bottom of the stacked shields (to help with separation)
    if(count>1) { 
        shield = shield.subtract(cutouts); //.translate([0,0,objectheight*i])
        supports = params.supports.scale([1,1,objectheight/20.25]); 
    }
    
    for(var i = 1; i<count; i++) { 

        let shieldtranslated = (shield.translate([0,0,i*objectheight]));

        parts.push(shieldtranslated); 
        partsIntersecting.push(supports.translate([0,0,objectheight*(i-1)]));                 
    }
    console.log(params.bottomReinforcement);
   
    if(count>2) partsIntersecting.push(params.feet);
    if(addmouseears) partsIntersecting.push(params.mouseEars);

    

    let partsUnion = parts[0];
    //console.log(parts);
    for(var i=1;i<parts.length;i++){
      //console.log(i,parts[i]);
      if(params.statusCallback){
        params.statusCallback({progress:20+10*i/parts.length, message:"Combining shield models "+i+" of "+count});
      }  
      partsUnion = partsUnion.unionForNonIntersecting(parts[i]);
       
      //console.log("done");
      

    }

    partsIntersectingUnion = new CSG(); 
    for(var i=0;i<partsIntersecting.length;i++){
      //console.log(i,parts[i]);
     
       
      //console.log("done");
      if(params.statusCallback){
        params.statusCallback({progress:30+40*i/partsIntersecting.length, message:"Combining extras "+(i+1)+" of "+count});
      }  
       partsIntersectingUnion = partsIntersectingUnion.union(partsIntersecting[i]);

    }

    params.statusCallback({progress:80, message:"Combining shields with supports"});
    partsUnion = partsUnion.union(partsIntersectingUnion); 
    

    if(params.addBottom && params.bottomReinforcement) { 

        
        let bounds = params.bottomReinforcement.getBounds(); 
        let centre = bounds[1].minus(bounds[0]).scale(0.5).plus(bounds[0]); 
      
        let bottomReinforcement = centrePolyOnFloor(params.bottomReinforcement);//.translate([-centre.x,-centre.y,-bounds[0].z]);
          console.log(bottomReinforcement);
        for(let i = 0; i<count; i++) { 
            partsUnion = partsUnion.unionForNonIntersecting(bottomReinforcement.translate([0,15-(i*10),0])); 
            params.statusCallback({progress:95, message:"Adding bottom reinforcement parts "+(i+1)+" of "+count});
        }

    }


    if(params.statusCallback){
      params.statusCallback({progress:100, message:"Complete"});
    }

    return partsUnion;
    
}


function centrePoly(poly) { 
    let bounds = poly.getBounds(); 
    let centre = bounds[1].plus(bounds[0]).scale(-0.5);
    return poly.translate([centre.x, centre.y, centre.z]);
}
 
function centrePolyOnFloor(poly) { 
    let bounds = poly.getBounds(); 
    let centre = bounds[1].plus(bounds[0]).scale(-0.5);
    return poly.translate([centre.x, centre.y, -bounds[0].z]);
}
  

module.exports = main;