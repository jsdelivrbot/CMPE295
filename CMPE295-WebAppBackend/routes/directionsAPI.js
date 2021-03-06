var googleMapsClient = require('@google/maps').createClient({
    key: 'ADD KEY',
    Promise: Promise
});

var mysql = require('./mysql');
var fs = require('fs');
var Client = require('node-rest-client').Client;
var client = new Client();
var cron = require('node-cron');


exports.distance = function (req, res) {
    googleMapsClient.directions({
        origin: req.param("source"),
        destination: req.param("destination"),
        mode: req.param("mode")
    }, function (err, response) {
        if (!err) {
            res.send(response.json.routes[0].legs[0].steps);
        }
    });
};

exports.totalTime = function (req, res) {
    googleMapsClient.directions({
        origin: req.param("source"),
        destination: req.param("destination"),
        mode: req.param("mode")
    }, function (err, response) {
        if (!err) {
            res.send(response.json.routes[0].legs[0].duration);
        }
    });
};

exports.latLng = function (req, res) {
    googleMapsClient.directions({
        origin: req.param("source"),
        destination: req.param("destination"),
        mode: "driving"
    }, function (err, response) {
        if (!err) {
            var json_responses = {};
            var stepsLatLng = [];
            var stepsObj = {};
            stepsLatLng.push(response.json.routes[0].legs[0].steps[0].start_location);
            for (var key in response.json.routes[0].legs[0].steps) {
              var regex = /<b>\s*(.*?)\s*<\/b>/g;
              while (m = regex.exec(response.json.routes[0].legs[0].steps[key].html_instructions)) {
                var match = m[0];
              }
              stepsObj = {
                "lat": response.json.routes[0].legs[0].steps[key].end_location.lat,
                "lng": response.json.routes[0].legs[0].steps[key].end_location.lng,
                "html_instructions": match
              };
              stepsLatLng.push(stepsObj);

                // stepsLatLng.push(response.json.routes[0].legs[0].steps[key].end_location);
            }
            json_responses = {
                "srcLat": response.json.routes[0].legs[0].start_location.lat,
                "srcLng": response.json.routes[0].legs[0].start_location.lng,
                "dstLat": response.json.routes[0].legs[0].end_location.lat,
                "dstLng": response.json.routes[0].legs[0].end_location.lng,
                "latLngSteps": stepsLatLng
            }
            console.log(json_responses);
            res.status(200).send(json_responses);
        }
    });
};

let getSteps = function (req) {
    return new Promise(function (resolve, reject) {
        googleMapsClient.directions({
            origin: req.body.source,
            destination: req.body.destination,
            mode: "driving"
        }, function (err, response) {
            if (!err) {
                var finalMatch = [];
                var finalSteps = [];
                var finalStepsObj = {};
                var firstdirection = "";
                for (var key in response.json.routes[0].legs[0].steps) {
                    var htmlInstruction = response.json.routes[0].legs[0].steps[key].html_instructions;
                    var regex = /<b>\s*(.*?)\s*<\/b>/g;
                    var matches = [];
                    while (m = regex.exec(htmlInstruction)) {
                        matches.push(m[1]);
                    }
                    if (firstdirection === "") {
                        firstdirection = mapDirections(matches[0], "");
                    }

                    if (matches.length > 1 && !("maneuver" in response.json.routes[0].legs[0].steps[key])) {
                        finalStepsObj = {
                            "Street Name": matches[1],
                            "Direction": firstdirection,
                            "distanceCovered": response.json.routes[0].legs[0].steps[key].distance.text,
                            "timeTaken": response.json.routes[0].legs[0].steps[key].duration.text
                        };
                    } else if (matches.length > 1) {
                        firstdirection = mapDirections(firstdirection, response.json.routes[0].legs[0].steps[key].maneuver);
                        finalStepsObj = {
                            "Street Name": matches[1],
                            "Direction": firstdirection,
                            "distanceCovered": response.json.routes[0].legs[0].steps[key].distance.text,
                            "timeTaken": response.json.routes[0].legs[0].steps[key].duration.text
                        };
                    } else {
                        finalStepsObj = {
                            "Street Name": matches[0],
                            "Direction": firstdirection,
                            "distanceCovered": response.json.routes[0].legs[0].steps[key].distance.text,
                            "timeTaken": response.json.routes[0].legs[0].steps[key].duration.text
                        };
                    }
                    finalMatch.push(matches);
                    finalSteps.push(finalStepsObj);
                }
                //console.log(finalMatch);
                var steps = {
                    "Summary": [
                        {"Start": response.json.routes[0].legs[0].start_address},
                        {"End": response.json.routes[0].legs[0].end_address},
                        {"Time": response.json.routes[0].legs[0].duration.text},
                        {"Start Time": req.param("timeOfDay")},
                        {"Day": req.param("dayOfWeek")}
                    ],
                    "steps": finalSteps
                }
                //console.log(steps);
                resolve(steps);
            } else {
                reject('Error getting response from Google');
            }
        });
    });
};

let getCongestion = function (getStepsResult) {
    return new Promise(function (resolve, reject) {
        var args = {
            data: getStepsResult,
            headers: {"Content-Type": "application/json"}
        };
        client.post("http://130.65.159.175:5000/getCongestion", args, function (data, response) {
            resolve(data);
        });
//		client.post("http://130.65.159.197:5000/traffic", args, function (data, response) {
//		    resolve(data);
//		});
//		resolve([{"CongestionRate": "65%",
//				   "StreetName": "W Julian St"},
//				   {"CongestionRate": "34%",
//					   "StreetName": "N 7th St"},
//					   {"CongestionRate": "53",
//						   "StreetName": "E San Fernando St"}]);
    });
};

let mapDirections = function (direction, menuver) {
    var newDirection;
    if (menuver == "turn-left") {
        if (direction == "southeast") {
            newDirection = "east";
        } else if (direction == "southwest") {
            newDirection = "south";
        } else if (direction == "northwest") {
            newDirection = "west";
        } else if (direction == "northeast") {
            newDirection = "north";
        } else if (direction == "north") {
            newDirection = "west";
        } else if (direction == "south") {
            newDirection = "east";
        } else if (direction == "east") {
            newDirection = "north";
        } else if (direction == "west") {
            newDirection = "south";
        } else {
            newDirection = direction;
        }
    } else if (menuver == "turn-right") {
        if (direction == "southeast") {
            newDirection = "south";
        } else if (direction == "southwest") {
            newDirection = "west";
        } else if (direction == "northwest") {
            newDirection = "north";
        } else if (direction == "northeast") {
            newDirection = "east";
        } else if (direction == "north") {
            newDirection = "east";
        } else if (direction == "south") {
            newDirection = "west";
        } else if (direction == "east") {
            newDirection = "south";
        } else if (direction == "west") {
            newDirection = "north";
        } else {
            newDirection = direction;
        }
    } else {
        newDirection = direction;
    }
    return newDirection;
}

exports.userInput = function (req, res) {
    getSteps(req).then(function (result) {
        return getCongestion(result)
    }).then(function (congestionResult) {
        var source = req.param("source");
        var destination = req.param("destination");
        var timeOfDay = req.param("time");
        var dayOfWeek = req.param("day");
        var json_responses;
        var insertUserInput = "insert into Travel(uid, src, dst, timeOfDay, dayOfWeek) select id, '"
            + source
            + "','"
            + destination
            + "','"
            + timeOfDay
            + "','"
            + dayOfWeek
            + "' from Users where email='"
            + req.session.email
            + "'";
        console.log("before mysql: " + insertUserInput);
        mysql.insertData(function (err, results) {
            if (err) {
                throw err;
            } else {
                json_responses = {
                    "statusCode": 200
                };
                res.send(json_responses);
            }
        }, insertUserInput);
        res.send(congestionResult);
    })
};


exports.directions = function (req, res) {
    googleMapsClient.directions({
        origin: req.param("source"),
        destination: req.param("destination"),
        mode: req.param("mode")
    }, function (err, response) {
        if (!err) {
            res.send(response.json.routes[0].legs[0].steps);
        }
    });
};


var task = cron.schedule('1-5 * * * *', function () {
    var arr = fs.readFileSync(
        './cronjobstreets.json');
    var responseObj = [];
    var promises = [];
//var listOfObjects = JSON.parse(arr);
    var listOfObjects = [
        {
            "src": "Casa Verde Street",
            "dst": "San Jose State Univerisity"
        },
        {
            "src": "San Jose State Univerisity",
            "dst": "Casa Verde Street"
        }];
    var today = new Date();
    listOfObjects.forEach(function (arrayItem) {
        var cronJobObj = {};
        console.log(arrayItem);
        promises.push(
            googleMapsClient.directions({
                origin: arrayItem.src + ', San Jose, CA',
                destination: arrayItem.dst + ', San Jose, CA',
                mode: 'driving'
            }).asPromise()
                .then((response) => {
                    cronJobObj['Source'] = arrayItem.src + ', San Jose, CA';
                    cronJobObj['Destination'] = arrayItem.dst + ', San Jose, CA';
                    cronJobObj['Date'] = today.getMonth() + "/"
                        + today.getDate() + "/"
                        + today.getFullYear();
                    cronJobObj['Time'] = today.getHours();
                    cronJobObj['TravelTime'] = response.json.routes[0].legs[0].duration;
                    cronJobObj['StartLatLng'] = response.json.routes[0].legs[0].start_location;
                    cronJobObj['EndLatLng'] = response.json.routes[0].legs[0].end_location;
                    cronJobObj['Steps'] = response.json.routes[0].legs[0].steps;
                    responseObj.push(cronJobObj);
                }).catch((err) => {
                console.log(arrayItem.src + " " + arrayItem.dst + " " + err);
            }));
    });

    Promise.all(promises).then(function () {
        var filename = './data/output-' + today.getMonth() + '-' + today.getDate() + '-' + today.getFullYear() + '-' + today.getHours() + '.json';
        fs.writeFile(filename, JSON.stringify(responseObj), {flag: "wx"}, function (err) {
            if (err) {
                return console.log(err);
            }

            console.log("The file was saved!");
        });
    }, function (err) {
        console.log(err);
    });
}, false);

//task.start();

// to store in MongoDB - Source | Destination | Date | Time | TravelTime |
// startLatlong | End Lat/long

exports.cronJob = function (req, res) {
    var arr = fs.readFileSync(
        './cronjobstreets.json');
    var responseObj = [];
    var promises = [];
    var listOfObjects = JSON.parse(arr);
//	var listOfObjects = [
//		   {
//			      "src": "Casa Verde Street",
//			      "dst": "San Jose State Univerisity"
//			   },
//			   {
//			      "src": "San Jose State Univerisity",
//			      "dst": "Casa Verde Street"
//			   }];
    var today = new Date();
    listOfObjects.forEach(function (arrayItem) {
        var cronJobObj = {};
        console.log(arrayItem);
        promises.push(
            googleMapsClient.directions({
                origin: arrayItem.src + ', San Jose, CA',
                destination: arrayItem.dst + ', San Jose, CA',
                mode: 'driving'
            }).asPromise()
                .then((response) => {
                    cronJobObj['Source'] = arrayItem.src + ', San Jose, CA';
                    cronJobObj['Destination'] = arrayItem.dst + ', San Jose, CA';
                    cronJobObj['Date'] = today.getMonth() + "/"
                        + today.getDate() + "/"
                        + today.getFullYear();
                    cronJobObj['Time'] = today.getHours();
                    cronJobObj['TravelTime'] = response.json.routes[0].legs[0].duration;
                    cronJobObj['StartLatLng'] = response.json.routes[0].legs[0].start_location;
                    cronJobObj['EndLatLng'] = response.json.routes[0].legs[0].end_location;
                    cronJobObj['Steps'] = response.json.routes[0].legs[0].steps;
                    responseObj.push(cronJobObj);
                }).catch((err) => {
                console.log(arrayItem.src + " " + arrayItem.dst + " " + err);
            }));
    });

    Promise.all(promises).then(function () {
        var filename = './data/output-' + today.getMonth() + '-' + today.getDate() + '-' + today.getFullYear() + '-' + today.getHours() + '.json';
        fs.writeFile(filename, JSON.stringify(responseObj), {flag: "wx"}, function (err) {
            if (err) {
                return console.log(err);
            }

            console.log("The file was saved!");
        });
        res.send(responseObj);
    }, function (err) {
        console.log(err);
    });
}


//exports.cronJob = function(req, res) {
////	var arr = fs.readFileSync(
////			'./streets.txt').toString().split(
////			"\n");
//	var listOfObjects = [];
//	var responseObj = [];
////	for(var i = 0; i < 1; i++) {
////		for(var j = 0; j < arr.length - 350; j++) {
////			if(arr[i] === arr[j]) continue;
////			var obj = {};
////	    	obj['src'] = arr[i];
////			obj['dst'] = arr[j];
////			listOfObjects.push(obj);
////		}
////		console.log(Object.keys(listOfObjects).length);
////	}
//	listOfObjects = [{ "src": "Casa Verde Street", "dst": "San Jose State Univerisity"},{ "src": "San Jose State Univerisity","dst": "Casa Verde Street"}];
//	var promises = [];
//	listOfObjects.forEach(function (arrayItem) {
//		var cronJobObj = {};
//		//console.log(arrayItem);
//		promises.push(
//		googleMapsClient.directions({
//			origin : arrayItem.src + ', San Jose, CA',
//			destination : arrayItem.dst + ', San Jose, CA',
//			mode : 'driving'
//		}).asPromise()
//		  .then((response) => {
//			var today = new Date();
//
//			cronJobObj['Source'] = arrayItem.src + ', San Jose, CA';
//			cronJobObj['Destination'] = arrayItem.dst + ', San Jose, CA';
//			cronJobObj['Date'] = today.getMonth() + "/"
//							+ today.getDate() + "/"
//							+ today.getFullYear();
//			cronJobObj['Time'] = today.getHours();
//			cronJobObj['TravelTime'] = response.json.routes[0].legs[0].duration;
//			cronJobObj['StartLatLng'] = response.json.routes[0].legs[0].start_location;
//			cronJobObj['EndLatLng'] = response.json.routes[0].legs[0].end_location;
//			responseObj.push(cronJobObj);
//		  })
//		  .catch((err) => {
//		    console.log(arrayItem.src + " " + arrayItem.dst+ " " +err);
//		  }));
//	});
//
//	Promise.all(promises).then(function() {
//		fs.writeFile("./output.txt", JSON.stringify(responseObj), function(err) {
//		    if(err) {
//		        return console.log(err);
//		    }
//
//		    console.log("The file was saved!");
//		});
//		res.send(responseObj);
//	}, function(err) {
//		console.log(err);
//	});
//}

exports.getDashboardCongestionRate = function (req, res) {

  // var reqBody = {
  //   "Source": req.body.source,
  //   "Destination": req.body.destination,
  //   "Day": req.body.dayOfWeek,
  //   "Time": req.body.timeOfDay
  // };
  //
  // var args = {
  //   data: reqBody,
  //   headers: {"Content-Type": "application/json"}
  // };
  //
  // client.post("http://130.65.159.175:5000/getCongestion", args, function (data, response) {
  //   res.send(data);
  // });

  func(function(){
    var reqBody = {
      "Source": req.body.source,
      "Destination": req.body.destination,
      "Day": req.body.dayOfWeek,
      "Time": req.body.timeOfDay
    };

    var args = {
      data: reqBody,
      headers: {"Content-Type": "application/json"}
    };
    client.post("http://130.65.159.175:5000/getCongestion", args, function (data, response) {
      res.send(data);
    });
  })
};

function func(callback){
  setTimeout(callback, 900);
}


