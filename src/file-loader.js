const stlSerializer = require('./CSGToStlb'); //originally @jscad/stl-serializer/CSGToStlb but copied out due to needing bug fix and changes 
const { CSG, CAG } = require('@jscad/csg');
const { deserialize } = require('@jscad/stl-deserializer');

const loadStl = function(url,onStatus) {

    return new Promise(function(resolve,reject){
        const options = {
            statusCallback: onStatus,
            output: "csg"
        };
        var xhr = new XMLHttpRequest();
		
		xhr.open('GET', url, true);
		
		xhr.onload = function(){
			var response = xhr.responseText;
            
            resolve( deserialize(this.responseText,undefined,options).toCompactBinary() );
		}
		
		xhr.overrideMimeType('text/plain; charset=x-user-defined');
        xhr.send();
    /*
       fetch(url).then(function (response) {
            if (response.ok) {
                
                response.text().then(function(buffer){
                    const options = {
                        statusCallback: onStatus,
                        output: "csg"
                      };
                    console.log("stl file loaded");
                   
                    resolve( deserialize(buffer,undefined,options).toCompactBinary() );
                });
            } else {
                console.error("stl loading failed");
                console.error(response.statusText);
                reject("loading failed");
            }
        });
        */
    });
}

module.exports = function(self){
    self.addEventListener("message",function(evt){
        let cmd = evt.data.cmd;
        console.log(evt.data.url);
        if(cmd === "load-stl"){
            loadStl(evt.data.url).then(function(data){                
                self.postMessage({"cmd":"complete", data,name:evt.data.name});    
            });
        }
    });
}