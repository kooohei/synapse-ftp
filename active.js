"use strict";

var SnpsFtp = require("./index.js");
var ftp = new SnpsFtp.SynapseFtp("192.168.11.10", 21, "hayashi", "kohei0730", true);
ftp.active(32630);

//{{{
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
//}}}
ftp.on(SnpsFtp.Events.CMD_CH_CONNECTED, function (res) {
	line("login()");
	ftp.login()
	.then(function (res) {
		line("Login Success");
		line(res);
		return ftp.options();
	}, function (err) {
		line("ERROR 1");
		line(err);	
	})
	.then(function (resAry) {
		line("Options Success");
		line(resAry);
		return ftp.list(".");
	}, function (err) {
		line("ERROR 2");
		line(err);
	})
	.then(function (res) {
		line("LIST Success");
		line(res);
		return ftp.quit();
	}, function (err) {
		line("ERROR 3");
		line(err);
	})
	.then(function (res) {
		line("QUIT Comamnd Success");
		line(res);
	});
	
});



function line (str) {
	console.log("\n==========================================================\n");	
	console.log(str);

}


ftp.connect();

