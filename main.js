const getParameterDefinitions = require('@jscad/core/parameters/getParameterDefinitions')
const getParameterValues = require('@jscad/core/parameters/getParameterValuesFromUIControls')
const { rebuildSolids, rebuildSolidsInWorker } = require('@jscad/core/code-evaluation/rebuildSolids')
const { mergeSolids } = require('@jscad/core/utils/mergeSolids')

// output handling
//const { generateOutputFile } = require('../io/generateOutputFile')
const { prepareOutput } = require('@jscad/core/io/prepareOutput')
const { convertToBlob } = require('@jscad/core/io/convertToBlob')
const { formats, supportedFormatsForObjects } = require('@jscad/core/io/formats')
const { generateOutputFile } = require('./generateOutputFile.js');
const covid19_headband_quadro_rc31 = require('./covid19_headband_quadro_rc31.js');

function init(){
  console.log('test2');
  console.log(covid19_headband_quadro_rc31);
}

document.addEventListener('DOMContentLoaded', function (event) {
  init()
})