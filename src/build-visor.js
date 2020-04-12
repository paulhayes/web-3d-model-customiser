const { union } = require("@jscad/csg/src/api/ops-booleans");
const { rectangular_extrude } = require("@jscad/csg/src/api/ops-extrusions");
const { vector_text } = require("@jscad/csg/src/api/text");
const { CSG } = require("@jscad/csg/api").csg;

function main(params) { 
    const setStatus = (pc) => {
      if(params.statusCallback){
        params.statusCallback({progress:pc});
      }
    };
    setStatus(0);
    console.log(params);
    const shield = params.model;
    const count = params.count;
    const name = params.name;
    const labellefttext = params.labellefttext;
    const labeloutlines1 = vector_text(0,0,labellefttext);
    const labeloutlines2 = vector_text(0,0,name);
    const addmouseears = params.addMouseEars;
    
    const layerheight = 0.25;
    const objectheight = 20 + layerheight;
    
    const cutouts = params.cutOuts.scale([1,1,0.5]);
    
    const depth=0.75;
    const xpos = 87.6-depth;
    const yposleft = -38;//-4;
    const yposright = -39;
    const zpos = -2;
    const textscaleY = 0.19;
    const textscaleX = 0.15;

    // pl = polyline (not closed)
    // extrude it to 3D
    const extrudeLabel = (outlines) => outlines.map(pl => rectangular_extrude(pl, {w: 4, h: depth}));

    const labelextruded1 = extrudeLabel(labeloutlines1);
    const labelextruded2 = extrudeLabel(labeloutlines2);

    setStatus(10);

    const labelobject1 = union(labelextruded1);
    const labelobject2 = union(labelextruded2);

    const z = zpos + objectheight/2;
    const leftbounds = labelobject1.scale([textscaleX,textscaleY,1]).getBounds();
    const labelsleft = (labelobject1.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(-90).translate([-xpos,yposleft+leftbounds[1].x,z]));
    const labelsright = (labelobject2.scale([textscaleX,textscaleY,1]).rotateX(90).rotateZ(90).translate([xpos,yposright,z]));

    setStatus(10);

    const subtractObjects = []
      .concat(name ? [labelsright] : [])
      .concat(labellefttext ? [labelsleft] : []);
    const subtractobject = subtractObjects.reduce((union, object) => union.union(object), new CSG());
    
    const stampedShield = subtractObjects.length ? shield.subtract(subtractobject) : shield;

    setStatus(20);

    const parts = Array.from(Array(count)).flatMap((_, i) => {
      const shieldtranslated = stampedShield.translate([0,0,i*objectheight]);
      if(i>0) {
        return [
          shieldtranslated.subtract(cutouts.translate([0,0,objectheight*i])),
          params.supports.translate([0,0,objectheight*(i-1)])
        ];
      } else {
        return [shieldtranslated];
      }
    })
    .concat(count > 2 ? [params.feet] : [])
    .concat(addmouseears ? [params.mouseEars] : []);

    const partsUnion = parts.slice(1).reduce((union, part, i) => {
      const newUnion = union.union(part);
      setStatus(20+70*i/parts.length);
      return newUnion;
    }, parts[0]);

    setStatus(100);

    return partsUnion;
}

module.exports = main;
