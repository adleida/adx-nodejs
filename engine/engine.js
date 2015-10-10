/**
 * Created by kliu on 06/06/2015.
 */

var http = require("http");
var winston = require('winston');
var js = require("jsonfile");
var validator = require("jsonschema");
var url = require('url');
var uuid = require('node-uuid');
var fs = require("fs");
var path = require("path");
var utils = require("../utils");

/**
 * Date: 10,10, 2015
 * now the protocol is separated from engine in the bidding process.
 * Engine is mainly responsible for listening for client request, sending them to dsps, then sending notices to dsps and bid result to client.
 * Protocol is mainly responsible for validating client request, auctioning and composing messages for client and dsps.
 * TO-DO: the regular request, response logger function should belong to Engine
 * @param rootDir
 * @constructor
 */
function Engine(rootDir){
    var self = this;
    self.state = self.ENGINE_STATE.STOPPED;
    self.rootDir = rootDir;
}

Engine.prototype.ENGINE_STATE = {
    STOPPED : 0,
    RUNNING : 1
};

Engine.prototype.launch = function(config){
    var self = this;
    if(self.state == self.ENGINE_STATE.STOPPED){
        //initial the engine
        winston.log('info', "starting engine...");
        self.timeout = parseInt(config.timeout);
        if(config.dsps && Array.isArray(config.dsps)){
            self.dsps = config.dsps;
        }else{
            winston.log("warning", "no dsp specified in configuration");
            self.dsps = [];
        }

        winston.log('info', "loading protocol...");
        self.loadProtocol(config.protocol);
        winston.log("info", "protocol loaded");
        self.state = self.ENGINE_STATE.RUNNING;
    }else if(self.state == self.ENGINE_STATE.RUNNING){
        winston.log('error', "ad exchange engine is already running");
        throw new Error("ad exchange engine already launched");
    }
};

Engine.prototype.loadProtocol = function(protocol){
    var self = this;
    var protocolDir = path.join(self.rootDir, 'protocols', protocol);
    var protocol = {};
    protocol.schemas = self.loadSchemas(protocolDir);
    protocol.filters = self.loadFilters(protocolDir);
    protocol.auctioneer = self.loadAndCheck(path.join(protocolDir, 'auctioneer.js'), ['auction']);
    protocol.clientRequestHandler = self.loadAndCheck(path.join(protocolDir, "clientRequestHandler.js"), ['handle']);
    protocol.clientResponseHandler = self.loadAndCheck(path.join(protocolDir, 'clientResponseHandler.js'), ['handle']);
    protocol.dspResponseHandler = self.loadAndCheck(path.join(protocolDir, 'dspResponseHandler.js'), []);
    self.protocol = protocol;
};

/**
 * load single js file, and return the loaded module
 * @param jsFilePath
 * @returns {*}
 */
Engine.prototype.loadJs = function(jsFilePath){
    try{
        return require(jsFilePath);
    }catch(error){
        throw new Error("fail to load js file " + jsFilePath);
    }
};

/**
 * load all js files under jsDirPath, return list of the loaded modules
 * @param jsDirPath
 * @returns {Array}
 */
Engine.prototype.loadJsDir = function(jsDirPath){
    var self = this;
    var jsFiles = fs.readdirSync(jsDirPath).filter(function(filename){
        return filename.substr(-3) == ".js";
    });
    var classes = [];
    jsFiles.forEach(function(jsFile){
        try{
            classes.push(require(path.join(jsDirPath , jsFile)));
        }catch(error){
            throw new Error("fail to load js file " + path.join(jsDirPath, jsFile));
        }
    });
    return classes;
};

Engine.prototype.loadSchemas = function(protocolDir){
    var self = this;
    var schemas = {};
    try{
        schemas.clientRequestSchema = js.readFileSync(path.join(protocolDir, 'schemas', 'clk-request-schema.json'));
        schemas.dspBidResponseSchema = js.readFileSync(path.join(protocolDir, 'schemas','bid-response-schema.json'));
    }catch(error){
        winston.log("error", "fail to load message schemas", error);
        throw new Error("message schema missing " + e.message);
    }
    return schemas;
};

/**
 *
 * @param schema
 * @param rawMessage
 * @constructor
 */
Engine.prototype.validResponse = function(schema, rawMessage){
    return utils.validateRawString(schema, rawMessage);
};

Engine.prototype.loadFilters = function(protocolDir){
    var self = this;
    var filters = [];
    self.loadJsDir(path.join(protocolDir, "filters")).forEach(function(filterCls){
        var filterObj = new filterCls();
        if(typeof(filterObj.filter) != "function"){ throw new Error(filterObj + " doesn't have filter()")};
        filters.push(filterObj);
    });
    return filters;
};

/**
 * load and initial an object from specified path, and check the function exists in this object
 * @param filePath
 * @param checkFuncs
 * @constructor
 */
Engine.prototype.loadAndCheck = function(filePath, checkFuncs){
    var self = this;
    var loadCls = require(filePath);
    var loadObj = new loadCls();
    checkFuncs.forEach(function(checkFunc){
        if(typeof(loadObj[checkFunc]) != "function"){ throw new Error(loadObj + " doesn't have " + checkFunc + "()")};
    });
    return loadObj;
};

/**
 * send bid request, if full response returned before timeout,
 * callback would be called to handle response, otherwise the connection would be aborted.
 * @param request_buffer
 * @param host
 * @param port
 * @param path
 * @param timeout
 * @param callback
 */
Engine.prototype.sendBid = function(request_buffer, host, port, path, timeout, callback){
    var options = {
        method : "POST",
        hostname: host,
        port: port,
        path: path,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": request_buffer.length
        }
    };

    var response = '';

    var req = http.request(options, function(res){
        res.on('data', function(data){
            //we do not check weathter stopped
            response += data;
        });

        res.on('end', function(){
            callback(response);
        })
    });

    winston.log('verbose', "send bid request to dsp %s [%s:%s%s]", dsp.id, dsp.bid_host, dsp.bid_port, dsp.bid_path);
    winston.log('debug', 'request content :\n %s', request_buffer);

    req.on('error', function(error){
       winston.log('error', "fail to send bid request to dsp %s [%s:%s%s], error %s", dsp.id, dsp.bid_host, dsp.bid_port, dsp.bid_path, error);
    });

    req.write(request_buffer);
    req.end(function(){
        setTimeout(timeout, function(){
            req.abort();
        });
    });
};

/**
 * validate the bid response use the response schema and return the parsed response in json format
 * or throw an error indicating the format error
 * @param response
 */
Engine.prototype.validateResponse = function(response){
    var responseJson = JSON.parse(response);
    var validateResult = self.validate('response', responseJson);
    if(validateResult.errors.length == 0){
        return responseJson;
    }else{
        throw new Error(validateResult.errors.join(";"));
    }
};

/**
 * send bid request to all the dsps registered, and expecting the bid response
 * then callback(response)
 * @param request, json object
 * @param dsps, array of dsps, each should contain the bid address, port
 * @param timeout, the bid response of the dsp should return before timeout
 * @param callback
 */
Engine.prototype.auction = function(request, dsps, timeout, callback){
    var self = this;
    var responses = [];
    var request_buffer = new Buffer(JSON.stringify(request), "utf-8");

    winston.log('info', 'start new auction, bid request id is  %s...', request.id);
    dsps.forEach(function(dsp, idx){
        self.sendBid(request_buffer, dsp.bid_host, dsp.bid_port, dsp.bid_path, timeout, function(response){
            try{
                responses.push(self.validResponse(self.protocol.schemas['DspBidResponse'], response));
            }catch(error){
                winston.log('error', "dsp %s return invalid response", dsp.id);
            }
        });
    });

    setTimeout(function(){
        callback(responses.slice(0));
    }, timeout + 1000);
};

/**
 * generate a random id for each request
 * @returns {string}
 */
Engine.prototype.generateID = function(){
    return uuid.v4();
};

/**
 * bid on the ad request, select winner from responses and notice dsps about the result
 * then callback(error, ad result)
 * @param request
 * @param dsps
 * @param timeout
 * @param callback
 */
Engine.prototype.bid = function(request, callback){
    //generate a random id for the request
    request.id = self.generateID();
    var wrappedRequest = self.clientRequestHandler.handle(request, self);
    var self = this;

    //copy the dsps so the filter could remove unnecessary dsps
    var dsps = self.dsps.slice(0);
    self.filterDsps(wrappedRequest, dsps);
    self.auction(wrappedRequest, dsps, self.timeout, function(responses) {
        var result = self.auctioneer.auction(wrappedRequest, responses, self);
        var winner = result[1];
        var loser = result[2];
        callback(null, self.clientResponseHandler.handle(request, result[0]));
        //notice each dsp about the result
        winner.forEach(function (response) {
            self.notice_dsp(self.protocol.dspResponseHandler.win(wrappedRequest, response, self));
        });
        loser.forEach(function (response) {
            winston.log("verbose", "notice dsp %s", response.did);
            self.notice_dsp(self.protocol.dspResponseHandler.fail(wrappedRequest, response, self));
        });
    });
};

Engine.prototype.filterDsps = function(requestJSON, dsps){
    var self = this;
    self.filters.forEach(function(filter){
        filter.filter(requestJSON, dsps, self);
    });
};

/**
 * array[0] is the url to notice
 * array[1] is the json message
 * @param array
 */
Engine.prototype.notice_dsp = function(array){
    var urlobj = url.parse(array[0]);
    var notice_buffer = new Buffer(JSON.stringify(array[1]), "utf-8");
    var option = {
        method : "POST",
        hostname: urlobj.hostname,
        port: urlobj.port,
        path: urlobj.path,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": notice_buffer.length
        }
    };

    var request = http.request(option);
    request.on('error', function(error){
        winston.log('info', 'fail to notice url %s, error %s', nurl, JSON.stringify(error));
    });
    request.write(notice_buffer);
    request.end();
};

exports.Engine = Engine;