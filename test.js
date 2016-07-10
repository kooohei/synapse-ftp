"use strict";

var SnpsFtp = require("./index.js");


var ftp = new SnpsFtp.SynapseFtp("bitglobe.net", 21, "hayashi", "kohei0730", true);

console.log(ftp);



ftp.on(SnpsFtp.Events.CMD_CH_ERROR, function (err, res) {
	console.log("CMD_CH_ERROR:", err, res);
});
ftp.on(SnpsFtp.Events.CMD_CH_CLOSED, function (haderr) {
	if (haderr) {
		console.log("CMD_CH_CLOSED WITH ERROR: ", haderr);
	} else {
		console.log("CMD_CH_CLOSED");
	}
});
ftp.on(SnpsFtp.Events.CMD_CH_TIMEOUT, function () {
	console.log("CMD_CH_TIMEOUT");
});
ftp.on(SnpsFtp.Events.CMD_CH_CONNECTED, function (res) {
	console.log(res);
	ftp.quit()
	.then(function (res) {
		console.log("QUIT COMMAND IS SUCCEED:", res);
		}, function (err) {
			console.log("FAILED QUIT COMMAND: ", err);	
		});
});


ftp.connect();
/*
.then(function (res) {
	console.log(res);
	ftp.quit()
	.then(function (res) {
		console.log("QUIT COMMAND IS SUCCEED:", res);
	}, function (err) {
		console.log("FAILED QUIT COMMAND: ", err);	
	});
})
.fail(function (err) {
	console.log(res);	
});
*/
