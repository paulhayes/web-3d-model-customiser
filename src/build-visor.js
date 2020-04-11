const { union } = require("@jscad/csg/src/api/ops-booleans");
const { rectangular_extrude } = require("@jscad/csg/src/api/ops-extrusions");
const { vector_text } = require("@jscad/csg/src/api/text");
const { CSG } = require("@jscad/csg/api").csg;

function main(params) { 
    if(params.statusCallback){
      params.statusCallback({progress:0});
    }
    console.log(params);
    shield = params.model;
    let count = params.count; 
    let name = params.name;
    let labellefttext = params.labellefttext;
    let labeloutlines1 = vector_text(0,0,labellefttext);
    let labelextruded1 = [];
    let labeloutlines2 = vector_text(0,0,name);
    let labelextruded2 = [];
    let addmouseears = params.addMouseEars;
    
    let layerheight = 0.25; 
    let objectheight = 20 + layerheight; 
    
    let cutouts = new CSG();
    if(params.cutOuts) cutouts = params.cutOuts.scale([1,1,0.5]);
    
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
    if(params.statusCallback){
      params.statusCallback({progress:10});
    }

    let labelobject1 = union(labelextruded1);
    let labelobject2 = union(labelextruded2);
    
    let z = zpos + objectheight/2; 
    let leftbounds = labelobject1.scale([textscaleX,textscaleY,1]).getBounds(); 
    let labelsleft = (labelobject1.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(-90).translate([-xpos,yposleft+leftbounds[1].x,z]));
    let labelsright = (labelobject2.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(90).translate([xpos,yposright,z]));

    if(params.statusCallback){
      params.statusCallback({progress:10});
    }


    let subtractobject = new CSG(); 
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

    if(params.statusCallback){
      params.statusCallback({progress:20});
    }


    let parts = []; 
    for(i = 0; i<count; i++) { 
        let shieldtranslated = (shield.translate([0,0,i*objectheight]));

        if(i>0) {
            
            parts.push(shieldtranslated.subtract(cutouts.translate([0,0,objectheight*i]))); 
            parts.push(params.supports.translate([0,0,objectheight*(i-1)]));
        } else { 
            parts.push(shieldtranslated); 
        } 
                    
    }
    if(count>2) parts.push(params.feet);
    if(addmouseears) parts.push(params.mouseEars);

    let partsUnion = parts[0];
    for(let i=1;i<parts.length;i++){
      
      partsUnion = partsUnion.union(parts[i]);
      if(params.statusCallback){
        params.statusCallback({progress:20+70*i/parts.length});
      }  
    }

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