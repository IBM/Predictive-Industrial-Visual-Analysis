require('dotenv').config();
// Libraries
var express = require('express'),
    //routes = require('./routes'),
    //user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    fs = require('fs');

var jsonfile = require( 'jsonfile' );
var request = require( 'request' );
var watson = require('watson-developer-cloud');
var fs = require('fs');
var Cloudant = require('cloudant');
var gm = require('gm').subClass({
      imageMagick: true
    });
var archiver = require('archiver');

var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var multipart = require('connect-multiparty')
var multipartMiddleware = multipart();

// Load credentials
// From Bluemix configuration or local file

var vcapServices = require('vcap_services');
// Cloudant Credentials
var cloudantCredentials = vcapServices.getCredentials('cloudantNoSQLDB');
var cloudant_username = cloudantCredentials.username || process.env.CLOUDANT_USERNAME;
var cloudant_pwd = cloudantCredentials.password || process.env.CLOUDANT_PASSWORD;
var cloudant_host = cloudantCredentials.host || process.env.CLOUDANT_HOST;
var cloudant_url = cloudantCredentials.url || process.env.CLOUDANT_URL;

//Visual Recognition Credentials
var vrCredentials = vcapServices.getCredentials('watson_vision_combined');
var vr_key = vrCredentials.api_key || process.env.VR_KEY;
var vr_url = vrCredentials.url || process.env.VR_URL;
var vr_classifiers = process.env.VR_CLASSIFIERS;

console.log (cloudant_url);
console.log (vr_key);

// Initialize Cloudant DB
var cloudant = Cloudant(cloudant_url);
var db;
var dbName = "image_db";
var dbCredentials = {
    dbName: 'image_db'
};

cloudant.db.create(dbName, function() {
    // Specify the database we are going to use (alice)...
    db = cloudant.db.use(dbName);
});

// Web server
var app = express();
app.set('views', './public/views');
//app.set('view engine', 'jade');
app.set('view engine', 'pug');


// all environments
app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.use(methodOverride());

//app.use(express.static(path.join(__dirname, 'public')));
app.use('/stylesheets', express.static(path.join(__dirname, '/public/stylesheets')));
app.use('/style', express.static(path.join(__dirname, '/public/stylesheets')));
app.use('/scripts', express.static(path.join(__dirname, '/public/scripts')));
app.use('/images', express.static(path.join(__dirname, '/public/images')));
app.use( '/public', express.static( __dirname + '/public' ) );

// development only
if ('development' == app.get('env')) {
    app.use(errorHandler());
}

function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    // Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

app.get('/simulator', function(req, res){
    //res.sendfile('index_simulator.html', { root: __dirname} );
    res.sendFile(path.join(__dirname + '/public/index_simulator.html'));
});

app.get('/testingpurposes', function (req, res) {
    //for now just returning all images.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        //this should really be sorted on the database
        body.rows = body.rows.sort(sortList);
        res.render("list", {body:body});

    });
});

app.get('/allimages', function (req, res) {
    //for now just returning all images.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        //this should really be sorted on the database
        body.rows = body.rows.sort(sortList);
        res.render("list", {body:body});

    });
});

app.get('/needimmediateattention', function (req, res) {
    //for now just returning all images.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        body.rows = body.rows.sort(sortList);
        var filtered_body = {};
        filtered_body.rows = [];

        //Count images that do need attention
        for (var i = 0; i < body.rows.length; i++) {
    		if(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score > 0.60 ||
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score > 0.60 ||
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score > 0.60 ||
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score > 0.60
    			//class[3] is Normal Condition, not needed here
    		) {
    			filtered_body.rows.push(body.rows[i]);
    		}
		}

        //console.log("Filtered DATA: " + JSON.stringify(filtered_body));
        res.render("list", {body:filtered_body});

    });
});

app.get('/mayneedattention', function (req, res) {
    //for now just returning all images.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        //this should really be sorted on the database
        body.rows = body.rows.sort(sortList);

        var filtered_body = {};
        filtered_body.rows = [];

        //Count images that do need attention
        for (var i = 0; i < body.rows.length; i++) {
    		if((body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score > 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score < 0.60) ||
    			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score > 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score < 0.60) ||
    			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score > 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score < 0.60) ||
    			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score > 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score < 0.60)
    			//class[3] is Normal Condition, not needed here
    		) {
    			filtered_body.rows.push(body.rows[i]);
    		}
		}

        res.render("list", {body:filtered_body});

    });
});

app.get('/doesnotneedattention', function (req, res) {
    //for now just returning all images.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        //this should really be sorted on the database
        body.rows = body.rows.sort(sortList);

        var filtered_body = {};
        filtered_body.rows = [];

        //Count images that do need attention
        for (var i = 0; i < body.rows.length; i++) {
    		if(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score < 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score < 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score < 0.40 &&
    			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score < 0.40
    			//class[3] is Normal Condition, not needed here
    		) {
    			filtered_body.rows.push(body.rows[i]);
    		}
		}

        res.render("list", {body:filtered_body});

    });
});


app.get('/dashboardtesting', function (req, res) {
    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        body.rows = body.rows.sort(sortList);

        console.log(JSON.stringify(body.rows));
        res.render("list", {body:body});

    });
});

app.get('/', function (req, res) {
    //for now just returning all image counts.
    //in the real world you would want to filter this list or truncate/page it

    db.view( 'image_db_images',  'image_db.images', function(err, body) {
        if (err) {
            console.log("Error during db view stage: " + err.toString());
            res.status(404).send(err.toString());
            return;
        }
        console.log("Body is: " + JSON.stringify(body));
        //this should really be sorted on the database
        body.rows = body.rows.sort(sortList);

        var red_count = 0;
        var yellow_count = 0;
        var green_count = 0;
		    var total_count = body.rows.length;



        for (var i = 0; i < body.rows.length; i++) {

          if ('analysis' in body.rows[i].key) {
        		if(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score < 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score < 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score < 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score < 0.40 ) {
      			     green_count++;
      		  }
          }
		    }

		    //Count images that may need attention
        for (var i = 0; i < body.rows.length; i++) {

          if ('analysis' in body.rows[i].key) {
        		if((body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score > 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score < 0.60) ||
        			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score > 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score < 0.60) ||
        			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score > 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score < 0.60) ||
        			(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score > 0.40 &&
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score < 0.60)) {
      			       yellow_count++;
            }
          }
    		}


		    //Count images that do need attention
        for (var i = 0; i < body.rows.length; i++) {
          if ('analysis' in body.rows[i].key) {
        		if(body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[0].score > 0.60 ||
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[1].score > 0.60 ||
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[2].score > 0.60 ||
        			body.rows[i].key.analysis.image_classify.images[0].classifiers[0].classes[4].score > 0.60 ) {
      			       red_count++;
      		  }
          }
		    }

        //console.log(JSON.stringify(body.rows));
        res.render("dashboard", {body:body, bodystring: JSON.stringify(body), total_count:total_count, green_count: green_count, yellow_count: yellow_count, red_count: red_count});

    });

});

app.get('/:id?/', function (req, res) {
    var id = req.params.id;
    db.get(id,function(err, body) {
        if (err) {
            console.log("Error during db get stage");
            res.status(404).send(err.toString());
            return;
        }
        res.render("detail", { body:body});
    });
});

app.get('/:id?/attachments/:fileName?', function (req, res) {
    var id = req.params.id;
    var fileName = req.params.fileName;
    db.attachment.get(id, fileName).pipe(res);
});

function sortList(a, b) {
    //return newest first
    if (a.key.sort > b.key.sort) {
        return -1;
    }
    if (a.key.sort < b.key.sort) {
        return 1;
    }
    return 0;
}

function createResponseData(id, name, value, attachments) {

    var responseData = {
        id: id,
        name: sanitizeInput(name),
        value: sanitizeInput(value),
        attachements: []
    };


    attachments.forEach(function(item, index) {
        var attachmentData = {
            content_type: item.type,
            key: item.key,
            url: '/api/favorites/attach?id=' + id + '&key=' + item.key
        };
        responseData.attachements.push(attachmentData);

    });
    return responseData;
}

function sanitizeInput(str) {
    return String(str).replace(/&(?!amp;|lt;|gt;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

var saveDocument = function(id, name, value, response) {

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    db.insert({
        name: name,
        value: value
    }, id, function(err, doc) {
        if (err) {
            console.log(err);
            response.sendStatus(500);
        } else
            response.sendStatus(200);
        response.end();
    });

}

app.get('/api/favorites/attach', function(request, response) {
    var doc = request.query.id;
    var key = request.query.key;

    db.attachment.get(doc, key, function(err, body) {
        if (err) {
            response.status(500);
            response.setHeader('Content-Type', 'text/plain');
            response.write('Error: ' + err);
            response.end();
            return;
        }

        response.status(200);
        response.setHeader("Content-Disposition", 'inline; filename="' + key + '"');
        response.write(body);
        response.end();
        return;
    });
});

app.post('/api/favorites/attach', multipartMiddleware, function(request, response) {

console.log("Upload File Invoked..");
console.log('Request: ' + JSON.stringify(request.headers));

var id;

db.get(request.query.id, function(err, existingdoc) {

        var isExistingDoc = false;
        if (!existingdoc) {
            id = '-1';
        } else {
            id = existingdoc.id;
            isExistingDoc = true;
        }

        var name = sanitizeInput(request.query.name);
        var value = sanitizeInput(request.query.value);

        var file = request.files.file;
        var newPath = './public/uploads/' + file.name;

        var insertAttachment = function(file, id, rev, name, value, response) {

            fs.readFile(file.path, function(err, data) {
                if (!err) {

                    if (file) {
						db.attachment.insert(id, "image.jpg", data, file.type, {
                        //db.attachment.insert(id, file.name, data, file.type, {
                            rev: rev
                        }, function(err, document) {
                            if (!err) {
                                console.log('Attachment saved successfully.. ');

                                db.get(document.id, function(err, doc) {
                                    console.log('Attachements from server --> ' + JSON.stringify(doc._attachments));

                                    var attachements = [];
                                    var attachData;
                                    for (var attachment in doc._attachments) {
                                        if (attachment == value) {
                                            attachData = {
                                                "key": attachment,
                                                "type": file.type
                                            };
                                        } else {
                                            attachData = {
                                                "key": attachment,
                                                "type": doc._attachments[attachment]['content_type']
                                            };
                                        }
                                        attachements.push(attachData);
                                    }
                                    var responseData = createResponseData(
                                        id,
                                        name,
                                        value,
                                        attachements);
                                    console.log('Response after attachment: \n' + JSON.stringify(responseData));
                                    response.write(JSON.stringify(responseData));
                                    response.end();
                                    return;
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                }
            });
        };

        if (!isExistingDoc) {
            existingdoc = {
                name: name,
                value: value,
                create_date: new Date()
            };

			// Create a date object with the current time
  			var now = new Date();
  			var year = now.getFullYear();
  			//var month = now.getMonth();
  			var month = ("0" + now.getMonth()).slice(-2);
  			//var day = now.getDate();
  			var day = ("0" + now.getDate()).slice(-2);
  			//var hours = (now.getHours() % 12) || 12;
  			//var hours = now.getHours();
  			var hours = ("0" + now.getHours()).slice(-2);
  			var minutes = ("0" + now.getMinutes()).slice(-2);
  			//var minutes = now.getMinutes();
  			//var seconds = now.getSeconds();
  			var seconds = ("0" + now.getSeconds()).slice(-2);

  			var now_timestamp = year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds + " +0000";
            console.log(now_timestamp);

            // save doc
            db.insert({
                name: name,
                value: value,
                type: "image_db.image",
  				timestamp: now_timestamp,
  				longitude: -95.34,
  				latitude: 47.626773,
  				region: "uum5e",
  				altitude: 10,
  				heading: 152.6,
  				cameraPitch: 0,
  				cameraHeading: 152.5,
  				aircraft: "Phantom Drone PD148"
            }, '', function(err, doc) {
                if (err) {
                    console.log(err);
                } else {

                    existingdoc = doc;
                    console.log("New doc created ..");
                    console.log(existingdoc);
                    insertAttachment(file, existingdoc.id, existingdoc.rev, name, value, response);

                }
            });

        } else {
            console.log('Adding attachment to existing doc.');
            console.log(existingdoc);
            insertAttachment(file, existingdoc._id, existingdoc._rev, name, value, response);
        }

    });

});

app.post('/api/favorites', function(request, response) {

    console.log("Create Invoked..");
    console.log("Name: " + request.body.name);
    console.log("Value: " + request.body.value);

    // var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    saveDocument(null, name, value, response);

});

app.delete('/api/favorites', function(request, response) {

    console.log("Delete Invoked..");
    var id = request.query.id;
    // var rev = request.query.rev; // Rev can be fetched from request. if
    // needed, send the rev from client
    console.log("Removing document of ID: " + id);
    console.log('Request Query: ' + JSON.stringify(request.query));

    db.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
            db.destroy(doc._id, doc._rev, function(err, res) {
                // Handle response
                if (err) {
                    console.log(err);
                    response.sendStatus(500);
                } else {
                    response.sendStatus(200);
                }
            });
        }
    });

});

app.put('/api/favorites', function(request, response) {

    console.log("Update Invoked..");

    var id = request.body.id;
    var name = sanitizeInput(request.body.name);
    var value = sanitizeInput(request.body.value);

    console.log("ID: " + id);

    db.get(id, {
        revs_info: true
    }, function(err, doc) {
        if (!err) {
            console.log(doc);
            doc.name = name;
            doc.value = value;
            db.insert(doc, doc.id, function(err, doc) {
                if (err) {
                    console.log('Error inserting data\n' + err);
                    return 500;
                }
                return 200;
            });
        }
    });
});

app.get('/api/favorites', function(request, response) {

    console.log("Get method invoked.. ");

    db = cloudant.use(dbCredentials.dbName);
    var docList = [];
    var i = 0;
    db.list(function(err, body) {
        if (!err) {
            var len = body.rows.length;
            console.log('total # of docs -> ' + len);
            if (len == 0) {
                // push sample data
                // save doc
                var docName = 'sample_doc';
                var docDesc = 'A sample Document';
                db.insert({
                    name: docName,
                    value: 'A sample Document'
                }, '', function(err, doc) {
                    if (err) {
                        console.log(err);
                    } else {

                        console.log('Document : ' + JSON.stringify(doc));
                        var responseData = createResponseData(
                            doc.id,
                            docName,
                            docDesc, []);
                        docList.push(responseData);
                        response.write(JSON.stringify(docList));
                        console.log(JSON.stringify(docList));
                        console.log('ending response...');
                        response.end();
                    }
                });
            } else {

                body.rows.forEach(function(document) {

                    db.get(document.id, {
                        revs_info: true
                    }, function(err, doc) {
                        if (!err) {
                            if (doc['_attachments']) {

                                var attachments = [];
                                for (var attribute in doc['_attachments']) {

                                    if (doc['_attachments'][attribute] && doc['_attachments'][attribute]['content_type']) {
                                        attachments.push({
                                            "key": attribute,
                                            "type": doc['_attachments'][attribute]['content_type']
                                        });
                                    }
                                    console.log(attribute + ": " + JSON.stringify(doc['_attachments'][attribute]));
                                }
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value,
                                    attachments);

                            } else {
                                var responseData = createResponseData(
                                    doc._id,
                                    doc.name,
                                    doc.value, []);
                            }

                            docList.push(responseData);
                            i++;
                            if (i >= len) {
                                response.write(JSON.stringify(docList));
                                console.log('ending response...');
                                response.end();
                            }
                        } else {
                            console.log(err);
                        }
                    });

                });
            }

        } else {
            console.log(err);
        }
    });

});

//handle custom classifier retrain request
app.post('/:id?/retrain/:posneg?/:classifierId?/:classifierClass?', function (req, res) {
    var id = req.params.id;
    var posneg = req.params.posneg;
    var classifierId = req.params.classifierId;
    var classifierClass = req.params.classifierClass;
    var currentTime = new Date().getTime();

    if (posneg == "positive" || posneg == "negative"){
        console.log("retraining");

        var rootDir = './temp';
        var dir = rootDir + "/" + currentTime;

        if (!fs.existsSync(rootDir)){
            fs.mkdirSync(rootDir);
        }
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }

        var tempFile = dir + "/" + id + ".jpg";
        var resizedFile = dir + "/" + id + "-resize.jpg";
        var zipFile = dir + "/" + id + ".zip";

        var cleanup = function() {
            console.log("cleanup");
            fs.unlink(tempFile, function (err) { })
            fs.unlink(resizedFile, function (err) { })
            fs.unlink(zipFile, function (err) { })
            fs.rmdir(dir, function (err) { })
        }

        db.attachment.get(id, "image.jpg", function(err, attachmentBody) {
            if (err) {
                res.status(500).send(err.toString());
                cleanup();
            } else {
                //write image to disk
                fs.writeFileSync(tempFile, attachmentBody);

                //resize image
                gm(tempFile).define("jpeg:extent=900KB").write(resizedFile,
                function (err) {
                    if (err) {
                        res.status(500).send(err.toString());
                        cleanup();
                    }

                    //create zip containing the image so we can send it to watson
                    var output = fs.createWriteStream(zipFile);
                    var archive = archiver('zip');
                    archive.pipe(output);

                    archive.on('error', function(err) {
                        res.status(500).send(err.toString());
                        cleanup();
                    });

                    archive.on('finish', function(err) {

                        //post positive-reinforcement data to Visual Recognition classifier
                        var formData = {
                            api_key:vr_key,
                            version:"2016-05-20"
                        };

                        if (posneg == "positive") {
                            formData[classifierClass + "_positive_examples"] = fs.createReadStream(zipFile);
                        }
                        else {
                            formData[classifierClass + "_positive_examples"] = fs.createReadStream("./training/tennis_positive.zip");
                            formData["negative_examples"] = fs.createReadStream(zipFile);
                        }
                        var url = "https://apikey:" + vr_key + "gateway.watsonplatform.net/visual-recognition/api/v3/classifiers/" + classifierId +"?version=2018-03-19";

                        request.post({url:url, formData: formData}, function optionalCallback(err, httpResponse, body) {
                            if (err) {
                                res.status(500).send(err.toString());
                            } else {
                                var response = body.toString();
                                res.status(200).send(response);
                                console.log(response);
                            }
                            cleanup();
                        });

                    });

                    archive.file(resizedFile, { name: 'image.jpg' });
                    archive.finalize();
                });
            }
        });
    } else {
        res.status(500).send();
    }
});


// Start listening
var port = ( process.env.PORT || 3000 );
app.listen( port );
console.log( 'Application is listening at: ' + port );
