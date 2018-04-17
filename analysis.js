/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the “License”);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an “AS IS” BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Called by Whisk.
 *
 * It expects the following parameters as attributes of "args"
 * - cloudantUrl: "https://username:password@host"
 * - cloudantDbName: "openwhisk-darkvision"
 * - watsonKey: "123456"
 * - doc: "image document in cloudant"
 */
function main(args) {
    console.log("Analysis Action called");
    console.log("Args:" + JSON.stringify(args));

    // require the openwhisk npm package
    var ow = require('openwhisk');

    // read apihost, auth, and namespace from params
    var apiHost = args.functionsHost;
    var namespace = "_";
    var auth = args.functionsAuth;

    // generate api_key from auth
    var base64Auth = new Buffer(auth).toString('base64');
    var apiKey = "Basic " + base64Auth;

    var options = {apihost: apiHost, api_key: apiKey, namespace: namespace};

    // instantiate the openwhisk instance before you can use it
    var openwhisk = ow(options);
    var newdocpattern = /^1-.*/g;
    var cloudantDocument = {};
    cloudantDocument.args = args;
    var fs = require('fs');
    var request = require('request');
    // nothing to do on deletion or update event
    if (cloudantDocument.args.deleted) {
        //console.log("[", cloudantDocument.args.id, "] Ignored, it was deleted");
        return {status : "Ignoring cloudant change feed since it was for document deletion"};
    } else if (newdocpattern.test(cloudantDocument.args.changes[0].rev)){
        console.log("New cloudant doc detected!");
        var cloudant = require("cloudant")(cloudantDocument.args.cloudantUrl);
        var db = cloudant.db.use(cloudantDocument.args.cloudantDbName);
        var fileName;
        var thumbFileName;

        //get document from cloudant
        var p0 = function(cloudantDocument) {
            console.log("Getting doc from Cloudant");
            var promise = new Promise(function(resolve, reject) {
                                      db.get(cloudantDocument.args.id, null, function(error, response) {
                                             if (!error) {
                                             console.log("Get DOC from cloudant successful " + JSON.stringify(response));

                                             //Adding args to cloudant document for future reference
                                             response.args = cloudantDocument.args;
                                             cloudantDocument = response;

                                             console.log("Entered Main Analysis Implementation");

                                             if (cloudantDocument.hasOwnProperty("_id") &&
                                                 cloudantDocument.type == "image_db.image" &&
                                                 !cloudantDocument.hasOwnProperty("analysis") &&
                                                 cloudantDocument.hasOwnProperty("_attachments") &&
                                                 cloudantDocument._attachments.hasOwnProperty("image.jpg") &&
                                                 !cloudantDocument._attachments.hasOwnProperty("thumbnail.jpg")) {

                                             console.log("DOC EXISTS!");
                                             var imageDocumentId = cloudantDocument._id;
                                             console.log("[", imageDocumentId, "] Processing image.jpg from document");

                                             resolve(cloudantDocument);
                                             } else {
                                             return {status: "Document did not contain correct properties, ignoring"};
                                             }

                                             } else {
                                             console.log("Error getting document");
                                             console.log(err);
                                             reject(err);
                                             }
                                             });
                                      });
            return promise;
        };

        var p1 = function(cloudantDocument) {
            console.log("Initial doc and args here: " + JSON.stringify(cloudantDocument));
            var promise = new Promise(function(resolve, reject) {
                                      db.get(imageDocumentId, null, function(error, response) {
                                             if (!error) {
                                             console.log('read success', response);
                                             resolve(cloudantDocument);
                                             } else {
                                             console.error('read error', error);
                                             reject(error);
                                             }
                                             });
                                      });
            return promise;
        };

        //Enrich cloudant document with Weather Data
        var p8 = function(cloudantDocument) {
            var promise = new Promise(function(resolve, reject) {
                                      cloudantDocument.weather = {};
                                      if (true) {
                                            resolve(cloudantDocument);
                                          }
                                          else {
                                            reject(Error("It broke"));
                                          }
                                      });
            return promise;
        };

        //Get Attachment from Cloudant
        var p2 = function(cloudantDocument) {
            console.log("After enriching data with Weather: " + JSON.stringify(cloudantDocument));
            fileName = cloudantDocument._id + "-image.jpg";
            var promise = new Promise(function(resolve, reject) {
                                      db.attachment.get(cloudantDocument._id, "image.jpg").pipe(fs.createWriteStream(fileName))
                                      .on("finish", function () {
                                          console.log("Completed get of attachment");
                                          resolve(cloudantDocument);
                                          })
                                      .on("error", function (err) {
                                          console.log("Error on get of attachment");
                                          reject(err);
                                          });
                                      });
            return promise;
        };

        //Process Thumbnail
        var p3 = function(cloudantDocument) {
            thumbFileName = cloudantDocument._id + "-thumbnail.jpg";
            var promise = new Promise(function(resolve, reject) {
                                      console.log("generating thumbnail");
                                      processThumbnail(cloudantDocument, fileName, thumbFileName, function (err, cloudantDocument, thumbFileName) {
                                                       if (err) {
                                                       console.log("Rejecting processThumbnail");
                                                       reject(err);
                                                       } else {
                                                       console.log("Resolving processThumbnail" + JSON.stringify(cloudantDocument));
                                                       resolve(cloudantDocument);
                                                       }
                                                       });
                                      });
            return promise;
        };

        //Process Image
        var p4 = function(cloudantDocument) {
            var promise = new Promise(function(resolve, reject) {
                                      console.log("processing & analyzing image")
                                      processImage(cloudantDocument, fileName, function (err, analysis) {
                                                   if (err) {
                                                   console.log("Rejecting processImage");
                                                   reject(err);
                                                   } else {
                                                   console.log("Resolving processImage");
                                                   cloudantDocument.analysis = analysis;
                                                   //console.log("Document info: " + JSON.stringify(cloudantDocument));
                                                   resolve(cloudantDocument);
                                                   }
                                                   });

                                      });
            return promise;
        };

        //Insert data into Cloudant
        var p5 = function(cloudantDocument) {
            var promise = new Promise(function(resolve, reject) {
                                      console.log("Updating document: " + cloudantDocument._id + ", rev: " + cloudantDocument._rev)
                                      db.insert(cloudantDocument, function (err, body, headers) {
                                                if (err) {
                                                console.log("Error reached while trying to update document");
                                                reject(err);
                                                } else {
                                                //console.log("BODY AFTER UUPDATE IS: " + JSON.stringify(body));
                                                //console.log("HEADERS AFTER UUPDATE IS: " + JSON.stringify(headers));
                                                cloudantDocument._rev = body.rev;
                                                console.log("doc after update is: " + JSON.stringify(cloudantDocument));
                                                resolve(cloudantDocument);
                                                }
                                                });
                                      });
            return promise;
        };

        //Insert attachment
        var p6 = function(cloudantDocument) {
            var promise = new Promise(function(resolve, reject) {
                                      console.log("saving thumbnail: " + thumbFileName + " to:");
                                      //console.log(JSON.stringify(cloudantDocument));

                                      fs.readFile(thumbFileName, function(err, data) {
                                                  if (err) {
                                                  reject(err);
                                                  } else {
                                                  console.log("ONE DB IS : " + JSON.stringify(db));
                                                  db.attachment.insert(cloudantDocument._id, 'thumbnail.jpg', data, 'image/jpg', {rev:cloudantDocument._rev}, function(err, body) {
                                                                       console.log("insert complete");
                                                                       //console.log(body);

                                                                       //remove thumb file after saved to cloudant
                                                                       var fs = require('fs');
                                                                       fs.unlink(thumbFileName);

                                                                       if (err) {
                                                                       console.log("ERROR DURING ATTACHMENT INSERT");
                                                                       console.log(err);
                                                                       reject(err);
                                                                       } else {
                                                                       console.log("saved thumbnail");
                                                                       //console.log("Body is: " + JSON.stringify(body));
                                                                       cloudantDocument._rev = body.rev;
                                                                       console.log("Doc: " + JSON.stringify(cloudantDocument));

                                                                       resolve(cloudantDocument);
                                                                       }
                                                                       });
                                                  }
                                                  });
                                      });
            return promise;
        };

        //Process faces
        var p7 = function(cloudantDocument) {
            var promise = new Promise(function(resolve, reject) {
                                      console.log("Processing faces");
                                      processFaces(cloudantDocument, fileName, db, cloudantDocument.analysis, function (err) {
                                                   var fs = require('fs');
                                                   fs.unlink(fileName);
                                                   console.log("Finished processing faces");
                                                   resolve(cloudantDocument);
                                                   });
                                      });
            return promise;
        };

        return p0(cloudantDocument).then(p8).then(p2).then(p3).then(p4).then(p5).then(p6).then(p7);

    } else {
        //console.log("Cloudant update detected, ignoring");
        return {status : "Ignoring cloudant change feed since it was for document update"};
    }
}

/**
 * Uses a callback so that this same code can be imported in another JavaScript
 * to test the function outside of OpenWhisk.
 *
 * mainCallback(err, analysis)
 */
function mainImpl(doc) {

}


/**
 * Prepares and analyzes the image.
 * processCallback = function(err, analysis);
 */
function processFaces(document, fileName, db, analysis, processCallback) {
    console.log("processing detected faces...");
    console.log("DB VALUE IS: " + JSON.stringify(db));
    var fs = require('fs');

    if (analysis && analysis.hasOwnProperty("face_detection")) {
        console.log("analysis has face_detection");

        var faceIndex = -1,
        facesToProcess = [],
        latestDocument = document;

        if (analysis.face_detection.images){
            if (analysis.face_detection.images.length > 0) {
                var images = analysis.face_detection.images;
                if (images[0].faces) {
                    facesToProcess = analysis.face_detection.images[0].faces;
                }
            }
        }

        //iteratively create images for each face that is detected
        var inProgressCallback = function (err) {
            console.log("inside inProgressCallback");
            faceIndex++;

            if (err) {
                processCallback( err );
                console.log(err)
            } else {
                if (faceIndex < facesToProcess.length) {
                    console.log('generating face ' + (faceIndex+1) + " of " + facesToProcess.length);
                    generateFaceImage(fileName, facesToProcess[faceIndex], "face" + faceIndex +".jpg", function(err, faceImageName) {

                                      if (err) {
                                      inProgressCallback(err);
                                      } else {

                                      //save to cloudant
                                      console.log("saving face image: " + faceImageName);
                                      fs.readFile(faceImageName, function(readErr, data) {
                                                  if (readErr) {
                                                  console.log("readErr reached");
                                                  inProgressCallback(err);
                                                  } else {
                                                  console.log("ABOUT TO INSERT FACE ATTACHMENT");
                                                  console.log("AND DOC IS: " + JSON.stringify(latestDocument));
                                                  console.log("AND REV IS: " + latestDocument._rev);
                                                  console.log("AND faceImageName IS: " + faceImageName);
                                                  console.log("DB VALUE IS: " + JSON.stringify(db));
                                                  console.log("TWO DB IS : " + JSON.stringify(db));

                                                  db.attachment.insert(latestDocument._id, faceImageName, data, 'image/jpg',
                                                                       {rev:latestDocument._rev}, function(saveErr, body) {
                                                                       if (!saveErr){
                                                                       console.log("insert complete");
                                                                       console.log("AFTER INSERT COMPLETE BODY IS: " + JSON.stringify(body));
                                                                       console.log("SAVE ERROR IS: " + saveErr);
                                                                       latestDocument._id = body.id;
                                                                       latestDocument._rev = body.rev;

                                                                       //remove thumb file after saved to cloudant
                                                                       var fs = require('fs');
                                                                       fs.unlink(faceImageName);

                                                                       console.log("saved thumbnail");
                                                                       inProgressCallback(saveErr);

                                                                       } else {
                                                                       console.log("SAVE ERROR IS: " + saveErr);
                                                                       return {ERROR: "Error during save faces"};
                                                                       }

                                                                       });
                                                  }
                                                  });

                                      }
                                      });
                } else {
                    processCallback(null)
                }
            }
        }

        inProgressCallback(null);
    }  ;
}

/**
 * Prepares the image, resizing it if it is too big for Watson or Alchemy.
 * prepareCallback = function(err, fileName);
 */
function generateFaceImage(fileName, faceData, faceImageName, callback) {

    console.log('inside generateFaceImage');
    var
    fs = require('fs'),
    async = require('async'),
    gm = require('gm').subClass({
                                imageMagick: true
                                });

    var face_location = faceData["face_location"];

    gm(fileName)
    .crop(face_location.width, face_location.height, face_location.left, face_location.top)
    .write(faceImageName, function (err) {
           if (err) {
           console.log(err);
           callback( err );
           } else {
           console.log('face image generation done: ' + faceImageName);
           callback(null, faceImageName);
           }
           });
}


/**
 * Prepares and analyzes the image.
 * processCallback = function(err, analysis);
 */
function processThumbnail(doc, fileName, thumbFileName, processCallback) {
    console.log("thumbfile name before generate: " + thumbFileName);
    generateThumbnail(fileName, thumbFileName, function (err) {
                      console.log("thumbfile name after generate: " + thumbFileName);

                      //save to cloudant
                      processCallback(err, doc, thumbFileName);
                      });
}

/**
 * Prepares the image, resizing it if it is too big for Watson or Alchemy.
 * prepareCallback = function(err, fileName);
 */
function generateThumbnail(fileName, thumbFileName, callback) {
    console.log("Inside of generateThumbnail");
    var
    fs = require('fs'),
    async = require('async'),
    gm = require('gm').subClass({
                                imageMagick: true
                                });
    console.log("Starting GM:");
    gm(fileName)
    .resize(200, 200)
    .write(thumbFileName, function (err) {
           if (err) {
           console.log(err);
           callback( err );
           } else {
           console.log('thumb generation done');
           callback(null, thumbFileName);
           }
           });
    console.log("completed thumbnail writing");

}


/**
 * Prepares and analyzes the image.
 * processCallback = function(err, analysis);
 */
function processImage(doc, fileName, processCallback) {
    prepareImage(fileName, function (prepareErr, prepareFileName) {
                 if (prepareErr) {
                 processCallback(prepareErr, null);
                 } else {
                 analyzeImage(doc, prepareFileName, function (err, analysis) {
                              processCallback(err, analysis);
                              });
                 }
                 });
}

/**
 * Prepares the image, resizing it if it is too big for Watson or Alchemy.
 * prepareCallback = function(err, fileName);
 */
function prepareImage(fileName, prepareCallback) {
    console.log("Prepare Image Method starting");
    var
    fs = require('fs'),
    async = require('async'),
    gm = require('gm').subClass({
                                imageMagick: true
                                });

    async.waterfall([
                     function (callback) {
                     // Retrieve the file size
                     fs.stat(fileName, function (err, stats) {
                             if (err) {
                             callback(err);
                             } else {
                             callback(null, stats);
                             }
                             });
                     },
                     // Check if size is OK
                     function (fileStats, callback) {
                     if (fileStats.size > 900 * 1024) {
                     // Resize the file
                     gm(fileName).define("jpeg:extent=900KB").write(fileName + ".jpg",
                                                                    function (err) {
                                                                    if (err) {
                                                                    callback(err);
                                                                    } else {
                                                                    // Process the modified file
                                                                    callback(null, fileName + ".jpg");
                                                                    }
                                                                    });
                     } else {
                     callback(null, fileName);
                     }
                     }
                     ], function (err, fileName) {
                    prepareCallback(err, fileName);
                    });
}

/**
 * Analyzes the image stored at fileName with the callback onAnalysisComplete(err, analysis).
 * analyzeCallback = function(err, analysis);
 */
function analyzeImage(doc, fileName, analyzeCallback) {
    console.log("Starting Analyze Image Method");
    var
    request = require('request'),
    async = require('async'),
    fs = require('fs'),
    gm = require('gm').subClass({
                                imageMagick: true
                                }),
    analysis = {};

    async.parallel([
                    function (callback) {
                    // Write down meta data about the image
                    gm(fileName).size(function (err, size) {
                                      if (err) {
                                      console.log("Image size", err);
                                      } else {
                                      analysis.size = size;
                                      }
                                      callback(null);
                                      });
                    },
                    function (callback) {
                    // Call Watson Visual Recognition Face Detection passing the image in the request
                    fs.createReadStream(fileName).pipe(
                                                       request({
                                                               method: "POST",
                                                               url: "https://gateway-a.watsonplatform.net" +
                                                               "/visual-recognition/api/v3/detect_faces" +
                                                               "?api_key=" + doc.args.watsonKey +
                                                               "&version=2016-05-20",
                                                               headers: {
                                                               'Content-Length': fs.statSync(fileName).size
                                                               },
                                                               json: true
                                                               },
                                                               function (err, response, body) {
                                                               if (err) {
                                                               console.log("Face Detection ERROR: ", err);
                                                               analysis.face_detection = {
                                                               error:err
                                                               }
                                                               } else {
                                                               console.log("Face Detection SUCCESS:")
                                                               console.log(body)
                                                               analysis.face_detection = body;
                                                               }
                                                               callback(null);
                                                               }))
                    },
                    function (callback) {
                    // Call Watson Visual Recognition Image Classifier passing the image in the request
                    console.log('CLASSIFIERS:' + doc.args.watsonClassifiers)
                    fs.createReadStream(fileName).pipe(
                                                       request({
                                                               method: "POST",
                                                               url: "https://gateway-a.watsonplatform.net" +
                                                               "/visual-recognition/api/v3/classify" +
                                                               "?api_key=" + doc.args.watsonKey +
                                                               "&version=2016-05-20&threshold=0.0&owners=me,IBM&classifier_ids=" + doc.args.watsonClassifiers,
                                                               headers: {
                                                               'Content-Length': fs.statSync(fileName).size
                                                               },
                                                               json: true
                                                               },
                                                               function (err, response, body) {
                                                               if (err) {
                                                               console.log("Image Classifier ERROR", err);
                                                               analysis.image_classify = {
                                                               error:err
                                                               }
                                                               } else {
                                                               console.log("Image Classifier SUCCESS:")
                                                               console.log(JSON.stringify(body))
                                                               analysis.image_classify = body;
                                                               }
                                                               callback(null);
                                                               }))
                    },
                    function (callback) {
                    // Call Watson Visual Recognition 'Recognize Text' passing the image in the request
                    fs.createReadStream(fileName).pipe(
                                                       request({
                                                               method: "POST",
                                                               url: "https://gateway-a.watsonplatform.net" +
                                                               "/visual-recognition/api/v3/recognize_text" +
                                                               "?api_key=" + doc.args.watsonKey +
                                                               "&version=2016-05-20",
                                                               headers: {
                                                               'Content-Length': fs.statSync(fileName).size
                                                               },
                                                               json: true
                                                               },
                                                               function (err, response, body) {
                                                               if (err) {
                                                               console.log("Recognize Text ERROR", err);
                                                               analysis.recognize_text = {
                                                               error:err
                                                               }
                                                               } else {
                                                               console.log("Recognize Text SUCCESS:")
                                                               console.log(body)
                                                               analysis.recognize_text = body;
                                                               }
                                                               callback(null);
                                                               }))
                    }
                    ],
                   function (err, result) {
                   analyzeCallback(err, analysis);
                   }
                   )
}

/**
 * Update a document in Cloudant database:
 * https://docs.cloudant.com/document.html#update
 **/

function cloudantupdatemain(message) {
    var cloudantOrError = getCloudantAccount(message);
    if (typeof cloudantOrError !== 'object') {
        return Promise.reject(cloudantOrError);
    }
    var cloudant = cloudantOrError;
    var dbName = message.dbname;
    var doc = message.doc;
    var params = {};

    if(!dbName) {
        return Promise.reject('dbname is required.');
    }

    if (typeof message.doc === 'object') {
        doc = message.doc;
    } else if (typeof message.doc === 'string') {
        try {
            doc = JSON.parse(message.doc);
        } catch (e) {
            return Promise.reject('doc field cannot be parsed. Ensure it is valid JSON.');
        }
    } else {
        return Promise.reject('doc field is ' + (typeof doc) + ' and should be an object or a JSON string.');
    }
    if(!doc || !doc.hasOwnProperty("_rev")) {
        return Promise.reject('doc and doc._rev are required.');
    }
    var cloudantDb = cloudant.use(dbName);

    if (typeof message.params === 'object') {
        params = message.params;
    } else if (typeof message.params === 'string') {
        try {
            params = JSON.parse(message.params);
        } catch (e) {
            return Promise.reject('params field cannot be parsed. Ensure it is valid JSON.');
        }
    }

    return insert(cloudantDb, doc, params);
}

/**
 * Inserts updated document into database.
 */
function insert(cloudantDb, doc, params) {
    return new Promise(function(resolve, reject) {
                       cloudantDb.insert(doc, params, function(error, response) {
                                         if (!error) {
                                         console.log('success', response);
                                         resolve(response);
                                         } else {
                                         console.log('error', error);
                                         reject(error);
                                         }
                                         });
                       });
}

function getCloudantAccount(message) {
    // full cloudant URL - Cloudant NPM package has issues creating valid URLs
    // when the username contains dashes (common in Bluemix scenarios)
    var cloudantUrl;

    if (message.url) {
        // use bluemix binding
        cloudantUrl = message.url;
    } else {
        if (!message.host) {
            return 'cloudant account host is required.';
        }
        if (!message.username) {
            return 'cloudant account username is required.';
        }
        if (!message.password) {
            return 'cloudant account password is required.';
        }

        cloudantUrl = "https://" + message.username + ":" + message.password + "@" + message.host;
    }

    return require('cloudant')({
                               url: cloudantUrl
                               });
}
