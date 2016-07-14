"use strict";

//{{{
var SnpsFtp = require("./index.js");
var ftp = new SnpsFtp.SynapseFtp("bitglobe.net", 21, "hayashi", "kohei0730", true);
//}}}

ftp.on(SnpsFtp.Events.CMD_CH_ERROR, function (err, res) {
	line("CMD_CH_ERROR");
	line(err);
	line(res);
});
ftp.on(SnpsFtp.Events.CMD_CH_CLOSED, function (haderr) {
	if (haderr) {
		line("CMD_CH_CLOSED WITH ERROR");
	} else {
		line("CMD_CH_CLOSED");	
	}
});
ftp.on(SnpsFtp.Events.CMD_CH_TIMEOUT, function () {
	line("CMD_CH_TIMEOUT");
});
ftp.on(SnpsFtp.Events.CMD_CH_CONNECTED, function (res) {
	line("login()");
	ftp.login()
	.then(function (res) {
		line("Login Success");
		line(res);
		line("list('.')");
		return ftp.list(".");
	})
	.then(function (res) {
		line("LIST Success");
		line(res);
		line("quit()");
		return ftp.quit();
	})
	.then(function (res) {
		line("QUIT Comamnd Success");
		line(res);
	})
	.fail(function (err) {
		line("ERROR");
		line(err);
	});
});



function line (str) {
	console.log("==========================================================\n");	
	console.log(str);
	console.log("\n");	
}


ftp.connect();

