function generateOutputFileFileSystem (extension, blob, callback) {
  var request = window.requestFileSystem || window.webkitRequestFileSystem
  if (!request) {
    throw new Error('Your browser does not support the HTML5 FileSystem API. Please try the Chrome browser instead.')
  }
  // console.log("Trying download via FileSystem API")
  // create a random directory name:
  var dirname = 'OpenJsCadOutput1_' + parseInt(Math.random() * 1000000000, 10) + '_' + extension
  var filename = 'output.' + extension // FIXME this should come from this.filename
  request(TEMPORARY, 20 * 1024 * 1024, function (fs) {
    fs.root.getDirectory(dirname, {create: true, exclusive: true}, function (dirEntry) {
      dirEntry.getFile(filename, {create: true, exclusive: true}, function (fileEntry) {
        fileEntry.createWriter(function (fileWriter) {
          fileWriter.onwriteend = function (e) {
            callback(fileEntry.toURL(), fileEntry.name)
          }
          fileWriter.onerror = function (e) {
            throw new Error('Write failed: ' + e.toString())
          }
          fileWriter.write(blob)
        },
          function (fileerror) { console.log(fileerror, 'createWriter') }
        )
      },
        function (fileerror) { console.log(fileerror, "getFile('" + filename + "')") }
      )
    },
      function (fileerror) { console.log(fileerror, "getDirectory('" + dirname + "')") }
    )
  },
    function (fileerror) { console.log(fileerror, 'requestFileSystem') }
  )
}


function generateOutputFileBlobUrl (extension, blob, callback) {
  if (isSafari()) {
    // console.log("Trying download via DATA URI")
    // convert BLOB to DATA URI
    const reader = new FileReader()
    reader.onloadend = function () {
      if (reader.result) {
        callback(reader.result, 'openjscad.' + extension, true, true)
      }
    }
    reader.readAsDataURL(blob)
  } else {
    // console.log("Trying download via BLOB URL")
    // convert BLOB to BLOB URL (HTML5 Standard)
    const windowURL = getWindowURL()
    const outputFileBlobUrl = windowURL.createObjectURL(blob)
    if (!outputFileBlobUrl) throw new Error('createObjectURL() failed')
    callback(outputFileBlobUrl, 'openjscad.' + extension, true, false)
  }
}


function generateOutputFile (extension, blob, onDone, context) {
  try {
    generateOutputFileFileSystem(extension, blob, onDone.bind(context))
  } catch (e) {
    generateOutputFileBlobUrl(extension, blob, onDone.bind(context))
  }
}

module.exports = {
  generateOutputFile
}
