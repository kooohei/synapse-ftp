/*jshint node: true, unused: false, devel: true, plusplus: false, laxcomma: true, nomen: true, regexp: true, indent: 2, maxerr: 50*/
/*global define, $, brackets, Mustache, window, appshell, module */

"use strict";

/* Import modules */
var Q							= require("q");
var net						= require("net");
var EventEmitter	= require("events").EventEmitter;
var util					= require("util");

/* Constants */
var PASSIVE		= 0,
		ACTIVE		= 1;

var ONLINE		= 0,
		OFFLINE		= 1;

var Events = {
	CMD_CH_ERROR				: 0,
		CMD_CH_CLOSED			: 1,
		CMD_CH_TIMEOU			: 2,
		CMD_CH_CONNECTED	: 3
};


function SynapseFtp(host, port, user, pass, keepAlive) {
	this.params = {
		host: host,
		port: port,
		user: user,
		pass: pass,
		keepAlive: keepAlive
	};
	
	this.cmdch	= null;
	this.cmdstate = OFFLINE;

	EventEmitter.call(this);
}
util.inherits(SynapseFtp, EventEmitter);


/**
 * connect()
 *
 * connect to the server.
 */
SynapseFtp.prototype.connect = function () { //{{{
	var self = this;
	var p = this.params;

	this.cmdch = net.connect(p.port, p.host);

	/* Register the Events */
	this.cmdch.on("error", function (err) {
		self.emit(Events.CMD_CH_ERROR, err);
	});
	this.cmdch.on("close", function (haderr) {
		self.cmdstate = OFFLINE;
		self.emit(Events.CMD_CH_CLOSED, haderr); 
	});
	this.cmdch.on("timeout", function () {
		self.emit(Events.CMD_CH_TIMEOUT);
	});
	
	this.cmdch.once("connect", function () {
		self.getResponse()
		.then(function (res) {

			if (res.code === 220) {
				
				self.cmdstate = ONLINE;
				self.emit(Events.CMD_CH_CONNECTED, res);

			} else {
			
				self.cmdstate = OFFLINE;
				self.emit(Events.CMD_CH_ERROR, new Error(), res);

			}

		}, function (err) {

			self.emit(Events.CMD_CH_ERROR, err);

		});
	});
}; //}}}

/**
 * getResponse()
 *
 * return promise object, that never rejected.
 * @reutrn {promise}
 */
SynapseFtp.prototype.getResponse = function () { // {{{
	var self	= this;
	var q			= Q.defer();
	var buf		= "";
	var obj		= {};

	function ToObject(res) {
		var match = res.match(/^([1-9][0-9]{2})\s(.*)/);
		var code	= match ? parseInt(match[1]) : 0;
		var msg		= match ? match[2] : "";
		return {
			code: code,
			msg	: msg,
			raw	: res
		};
	}

	var onData = function (chunk) {
		buf += chunk;
		if (buf.match(/^([1-9][0-9]{2})-[\s|\S]+?\1\s.+?\r\n$/m)) {	// is multi lines.

			obj = ToObject(buf);
			q.resolve(obj);
			self.cmdch.removeListener("data", onData);

		} else if (buf.match(/^([1-9][0-9]{2})\s.+?\r\n$/)) {				// is single line.

			obj = ToObject(buf);
			q.resolve(obj);
			self.cmdch.removeListener("data", onData);
		}
	};
	this.cmdch.on("data", onData);
	return q.promise;
}; // }}}


/**
 * quit()
 */
SynapseFtp.prototype.quit = function () {
	var q = Q.defer();
	this.rawcmd("QUIT")
		.then(function (res) {
			if (res.code === 221)
				q.resolve(res);
				else
				q.reject(res);
		});
	return q.promise;
};


/**
 * rawcmd(cmd)
 */
SynapseFtp.prototype.rawcmd = function (cmd) {
	var self = this;
	var q = Q.defer();

	this.cmdch.write(cmd + "\r\n", function () {
		self.getResponse()
			.then(function (res) {
				q.resolve(res);
			});
	});
	return q.promise;
};

exports.SynapseFtp = SynapseFtp;
exports.Events		 = Events;
