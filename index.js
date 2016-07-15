/jshint node: true, unused: false, devel: true, plusplus: false, laxcomma: true, nomen: true, regexp: true, indent: 2, maxerr: 50*/
/*global define, $, brackets, Mustache, window, appshell, module */
"use strict";

/**
 * TODO
 * Make sure each "on" => "once"
 */




/* Import modules */
var Q							= require("q");
var net						= require("net");
var EventEmitter	= require("events").EventEmitter;
var util					= require("util");
var os						= require("os");
var fs						= require("fs");
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
		keepAlive: keepAlive,
		passive: true,
		secure: false,
	};
	
	this.cmdch	= null;
	this.cmdstate = OFFLINE;

	EventEmitter.call(this);
}
util.inherits(SynapseFtp, EventEmitter);

/**
 * active
 *
 * This function change the Data Connection Mode to the ACTIVE.
 */
SynapseFtp.prototype.active = function (port) {
	this.params.passive = false;
	this.params.listenPort = port;
};

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
		self.getCmdResponse()
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
 * getCmdResponse()
 *
 * return promise object, that never rejected.
 * @reutrn {promise}
 */
SynapseFtp.prototype.getCmdResponse = function () { // {{{
	var self	= this;
	var q			= Q.defer();
	var buf		= "";
	var obj		= {};

	function ToObject(res) {
		var match = res.match(/^([1-9][0-9]{2})[\s-](.*)/);
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
		if (buf.match(/^([1-9][0-9]{2})-[\s\S]+?\1\s.+?\r\n$/m)) {	// is multi lines.
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
 * rawcmd(cmd)
 */
SynapseFtp.prototype.rawcmd = function (cmd) {
	var self = this;
	var q = Q.defer();

	this.cmdch.write(cmd + "\r\n", function () {
		self.getCmdResponse()
		.then(function (res) {
			q.resolve(res);
		});
	});
	return q.promise;
};

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


SynapseFtp.prototype.syst = function () {
	var q = Q.defer();
	this.rawcmd("SYST")
	.then(function (res) {
		if (res.code === 215) 
			q.resolve(res);
		else
			q.reject(res);
	});
	return q.promise;
};

SynapseFtp.prototype.feat = function () {
	var q = Q.defer();
	this.rawcmd("FEAT")
	.then(function (res) {
		if (res.code === 211)
			q.resolve(res);
		else
			q.reject(res);
	});
	return q.promise;
};

SynapseFtp.prototype.opts = function (param) {
	var q = Q.defer();
	this.rawcmd("OPTS " + param)
	.then(function (res) {
		if (res.code === 200)
			q.resolve(res)
		else
			q.reject(res)
	});
	return q.promise;
};

SynapseFtp.prototype.prot = function (param) {
	var q = Q.defer();
	this.rawcmd("PROT " + param)
	.then(function (res) {
		if (res.code === 200)
			q.resolve(res);
		else
			q.reject(res);
	});
	return q.promise;
};

SynapseFtp.prototype.type = function (param) {
	var q = Q.defer();
	this.rawcmd("TYPE " + param)
	.then(function (res) {
		if (res.code === 200)
			q.resolve(res)
		else
			q.reject(res)
	});
	return q.promise;
};

SynapseFtp.prototype.options = function () {
	var q = Q.defer();
	var ary = [];
	var self = this;

	this.syst()
	.then(function (res) {
		ary.push(res);
		return self.feat();
	}, function (err) {
		q.reject(err);
	})
	.then(function (res) {
		ary.push(res);
		return self.opts("UTF8 ON");
	}, function (err) {
		q.reject(err);
	})
	.then(function (res) {
		ary.push(res);
		return self.type("I");
	}, function (err) {
		q.reject(err);
	})
	.then(function (res) {
		ary.push(res);
		if (self.params.secure) {
			self.prot("P")
			.then(function (res) {
				ary.push(res);
				q.resolve(ary);
			}, function (err) {
				q.reject(err);
				return q.promise;
			})
		} else {
			q.resolve(ary);
		}
	}, q.reject);
	
	return q.promise;
};

/**
 * pasv()
 */
SynapseFtp.prototype.pasv = function () {
	var q = Q.defer();
	var self = this;

	function convertAddress(pasvRes) {
		var tmp = pasvRes.split(",");
		var hex = (parseInt(tmp[4]).toString(16)) + (parseInt(tmp[5]).toString(16));
		return {ip: tmp[0] + "." + tmp[1] + "." + tmp[2] + "." + tmp[3], port: parseInt(hex, 16)};
	}

	this.rawcmd("PASV")
	.then(function (res) {
		if (res.code === 227) {
			var match = res.msg.match(/^.+?\s\((.+?)\)\./);
			if (match) {
				res.addr = convertAddress(match[1]);
				q.resolve(res);
			} else {
				var er = new Error("Could not found remote address in response");
				q.reject(er);
			}
		} else {
			q.reject(res);
		}
	});
	return q.promise;
};

/**
 * getLoalAddress
 */
function getLocalAddress() {
	var ifacesObj = {}
	ifacesObj.ipv4 = [];
	ifacesObj.ipv6 = [];
	var interfaces = os.networkInterfaces();
	
	Object.keys(interfaces).forEach(function (dev) {
		interfaces[dev].forEach(function(details){
			if (!details.internal){
				switch(details.family){
					case "IPv4":
						ifacesObj.ipv4.push({name:dev, address:details.address});
					break;
					case "IPv6":
						ifacesObj.ipv6.push({name:dev, address:details.address})
					break;
				}
			}
		});
	});
	return ifacesObj.ipv4[0].address;
};


/**
 * port()
 */
SynapseFtp.prototype.port = function () {
	var q = Q.defer();
	var self = this;
	function createParameter() {
		var hex = self.params.listenPort.toString(16);
		var h	= hex.substr(0, 2);
		var l	= hex.substr(2, 4);
		h = parseInt(h, 16);
		l = parseInt(l, 16);
		var adr = getLocalAddress(); 
		return adr.replace(/\./g, ",") + "," + h + "," + l;
	}
	var p = createParameter();

	this.rawcmd("PORT " + p)
	.then(function (res) {
		if (res.code !== 200) {
			q.reject(res);
		} else {
			q.resolve(res);
		}
	})
	return q.promise;
};



/**
 * user()
 */
SynapseFtp.prototype.user = function () {
	var q = Q.defer();
	var self = this;
	this.rawcmd("USER " + self.params.user)
	.then(function (res) {
		if (res.code === 331)
			q.resolve(res);
		else
			q.reject(res);
	});
	return q.promise;
};

/**
 * pass()
 */
SynapseFtp.prototype.pass = function () {
	var q = Q.defer();
	var self = this;
	this.rawcmd("PASS " + self.params.pass)
	.then(function (res) {
		if (res.code === 230)
			q.resolve(res);
		else
			q.reject(res);
	});
	return q.promise;
};


/**
 * login()
 */
SynapseFtp.prototype.login = function () {
	var q = Q.defer();
	var ary = [];
	var self = this;
	this.user()
	.then(function (res) {
		ary.push(res);
		return self.pass();	
	})
	.then(function (res) {
		ary.push(res);
		q.resolve(ary)
	})	
	.fail(q.reject);
	return q.promise;
};

SynapseFtp.prototype.list = function (basedir) {

	if (this.params.passive) {
		return this.pasvList(basedir);
	} else {
		return this.actvList(basedir);
	}

};


SynapseFtp.prototype.pasvUpload = function (local, remote) {
	var q = Q.defer(),
			self = this,
			result = [];

	this.pasv()
	.then(function (res) {
		if (res.code !== 227) {
			q.reject(res);
		} else {
			result.push(res);

			self.rawcmd("STOR " + remote)
			.then(function (res) {
				result.push(res);
			}, function (err) {
				q.reject(err);	
			});
			
			var datach = net.connect(res.addr.port, res.addr.ip, function () {
				var r = fs.createReadStream(local);
				r.once("close", function () {
					self.getCmdResponse()
					.then(function(res) {
						if (res.code !== 226) {
							q.reject(res);
						} else {
							result.push(res);
							q.resolve(result);
						}
					});
				});
				r.pipe(datach);
			});
			datach.once("error", q.reject);

		}	
	});
	return q.promise;
};


/**
 * pasvList(basedir)
 */
SynapseFtp.prototype.pasvList = function (basedir) { //{{{
	var q = Q.defer(),
			self = this,
			buf = "",
			result = {
				res: [],
				list: ""
			};

	var onData = function (chunk) {
		buf += chunk;	
	};

	this.pasv()
	.then(function (res) {
		if (res.code !== 227) {
			q.reject(res);
			return q.promise;
		} else {
			result.res.push(res);
		}

		self.cmdch.write("LIST " + basedir + "\r\n");
		self.getCmdResponse()
		.then(function (res) {
			if (res.code !== 150) {
				q.reject(res);	
				return q.promise;
			} else {
				result.res.push(res);
			}
		});
		
		var datach = net.connect(res.addr.port, res.addr.ip);
			
		datach.on("data", onData);

		datach.once("error", function (err) {
			q.reject(err);
			return q.promise;
		});

		datach.once("close", function (err) {
			if (err) {
				q.reject(err);
				return q.promise;
			} else {
				datach.removeListener("data", onData);
			}
		});

		datach.once("end", function () {
			self.getCmdResponse()
			.then(function (res) {
				if (res.code !== 226) {
					q.reject(res);
				} else {
					result.res.push(res);
					result.list = buf;
					q.resolve(result);
				}
			});
		});
	});
	
	return q.promise
}; // }}}


/**
 * actvList(basedir)
 */
SynapseFtp.prototype.actvList = function (basedir) {
	var q = Q.defer(),
			self = this,
			buf = "",
			result = {
				res: [],
				list: ""
			};
	
	var onData = function (chunk) {
		buf += chunk;
	};

	this.port()
	.then(function (res) {
		if (res.code !== 200) {
			q.reject(res);
			return q.promise;
		}
		result.res.push(res);

		var server = net.createServer();
		var adr = getLocalAddress();
		server.listen(self.params.listenPort, adr, function () {

			out("SERVER BOUND ADDRESS");

			self.cmdch.write("LIST " + basedir + "\r\n");
			self.getCmdResponse()
			.then(function (res) {
				out("LIST COMMAND OK");
				
				if (res.code !== 150) {
					out("ERROR 2");
					return q.promise;
				} else {
					out(res);
					result.res.push(res);	
				}
			});
			//{{{
			server.once("connection", function (datach) {

				datach.on("data", onData);
				datach.on("end", function () {
					self.getCmdResponse()
					.then(function (res) {
						result.res.push(res);
					});
				});

				datach.once("close", function (err) {
					if (err) {
						q.reject(err);
						return q.promise;
					} else {
						result.list = buf;
						q.resolve(result);
					}
					datach.removeListener("data", onData);
				});
			});
			//}}}
		});
	});
	return q.promise;
};



SynapseFtp.prototype.upload = function (local, remote) {
	if (this.params.passive) {
		return this.pasvUpload(local, remote);
	} else {
		return this.actvUpload(local, remote);
	}
};

/**
 * actvUpload(local, remote)
 */
SynapseFtp.prototype.actvUpload = function (local, remote) {
	var q = Q.defer(),
			self = this,
			result = [];
	
	this.port()
	.then(function (res) {
		if (res.code !== 200) {
			q.reject(res);
			return q.promise;
		} else {
			result.push(res);
		}		

		var server = net.createServer();
		var adr = getLocalAddress();

		server.listen(self.params.listenPort, adr, function () {

			self.cmdch.write("STOR " + remote + "\r\n");
			self.getCmdResponse()
			.then(function (res) {
				if (res.code !== 150) {
					q.reject(res);
					return q.promise;
				}
				result.push(res);
			});
			
			server.once("connection", function (datach) {
				var r = fs.createReadStream(local);
				r.pipe(datach);
				r.once("error", function (err) {
					q.reject(err);
					return q.promise;
				});
				r.once("close", function (hadErr) {
					if (hadError) {
						q.reject(hadError);
					} else {
						self.getCmdResponse()
						.then(function (res) {
							if (res.code !== 226) {
								q.reject(res);
								return q.promise;
							} else {
								result.push(res);
								q.resolve(result);
							}
						});
					}
				});
			});
			
		});
	}, function (err) {
		q.reject(err);	
	});
	return q.promise;
};





function out(str) {
	console.log("\n>>>>>>>>>>>\n");
	console.log(str);
}

exports.SynapseFtp = SynapseFtp;
exports.Events		 = Events;
