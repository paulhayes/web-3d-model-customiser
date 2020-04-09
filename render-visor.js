const { union } = require('./ops-booleans');

function main(params) { 
    console.log(params.model);
    let shield = cube([100,100,100]); //params.model; 
    console.log(shield);
    shield = params.model;
    let count = params.count; 
    let name = params.name;
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
  