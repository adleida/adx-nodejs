/**
 * Created by kliu on 06/06/2015.
 */

var http = require("http");
var winston = require('winston');
var js = require("jsonfile");
var url = require('url');
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
        winston.log('verbose', 'engine timeout is ' + self.timeout);

        if(config.dsps && Array.isArray(config.dsps)){
            self.dsps = config.dsps;
            winston.log('verbose', "engine starting dsps are " + self.dsps);
        }else{
            winston.log("warning", "no dsp specified in configuration");
            self.dsps = [];
        }

        winston.log('info', "loading protocol...");
        self.loadProtocol(config.protocol);
        winston.log("info", "protocol loaded");
        self.state = self.ENGINE_STATE.RUNNING;
        winston.log("info","engine start running...");

    }else if(self.state == self.ENGINE_STATE.RUNNING){
        winston.log('error', "ad exchange engine is already running");
        throw new Error("ad exchange engine already launched");
    }
};

Engine.prototype.loadProtocol = function(protocol){
    var self = this;
    var protocolDir = path.join(self.rootDir, 'protocols', protocol);
    var ret = {};
    ret.name = protocol;
    ret.schemas = self.loadSchemas(protocolDir);
    ret.filters = self.loadFilters(protocolDir);
    ret.auctioneer = utils.loadAndCheck(path.join(protocolDir, 'auctioneer.js'), ['auction']);
    ret.clientRequestHandler = utils.loadAndCheck(path.join(protocolDir, "clientRequestHandler.js"), ['handle']);
    ret.clientResponseHandler = utils.loadAndCheck(path.join(protocolDir, 'clientResponseHandler.js'), ['handle', 'handleInvalidBidRequest']);
    ret.dspResponseHandler = utils.loadAndCheck(path.join(protocolDir, 'dspResponseHandler.js'), []);
    self.protocol = ret;
};

Engine.prototype.loadSchemas = function(protocolDir){
    var schemas = {};
    try{
        schemas.clientRequestSchema = js.readFileSync(path.join(protocolDir, 'schemas', 'clk-request-schema.json'));
        schemas.dspBidResponseSchema = js.readFileSync(path.join(protocolDir, 'schemas','bid-response-schema.json'));
    }catch(error){
        winston.log("error", "fail to load message schemas", error);
        throw new Error("message schema missing " + error.message);
    }
    return schemas;
};

Engine.prototype.validateJSON = function(schema, json){
    return utils.validateJSON(schema, json);
};

Engine.prototype.loadFilters = function(protocolDir){
    var filters = [];
    try{
        var jsFiles = fs.readdirSync(path.join(protocolDir, "filters"));
        jsFiles.forEach(function(jsFile){
            filters.push(utils.loadAndCheck(path.join(protocolDir, "filters", jsFile), ['filter']));
        });
    }catch(error){
        winston.log("error", "fail to load filters, error " + error);
    }
    return filters;
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

    winston.log('verbose', "send bid request to dsp [%s:%s%s]", host, port, path);
    winston.log('debug', 'request content :\n %s', request_buffer.toString());

    req.on('error', function(error){
       winston.log('error', "fail to send bid request to dsp [%s:%s%s]", host, port, path);
    });

    req.write(request_buffer);
    req.end();
    setTimeout(function(){
        req.abort();
    }, timeout);
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

    winston.log('verbose', 'start new auction, bid request id is  %s...', request.id);
    dsps.forEach(function(dsp){
        self.sendBid(request_buffer, dsp.bid_host, dsp.bid_port, dsp.bid_path, timeout, function(response){
            winston.log("debug", "response from dsp : " + response);
            try{
                responses.push(self.validateJSON(self.protocol.schemas['dspBidResponseSchema'], JSON.parse(response)));
            }catch(error){

                winston.log('verbose', "message validation failed, error: " + error);
                winston.log('error', "dsp %s return invalid response", dsp.id);
            }
        });
    });

    setTimeout(function(){
        callback(responses.slice(0));
    }, timeout + 1000);
};

/**
 * bid on the ad request, select winner from responses and notice dsps about the result
 * then callback(error, ad result)
 * @param request
  * @param callback
 */
Engine.prototype.bid = function(request, callback){
    var self = this;
    var requestJson = null;
    winston.log("debug", "receive request: " + request);
    try{
        requestJson = self.validateJSON(self.protocol.schemas['clientRequestSchema'], request);
    }catch(error){
        winston.log("verbose", "invalid request from client");
        callback(error, self.protocol.clientResponseHandler.handleInvalidBidRequest(request, error, self));
        return;
    }
    var wrappedRequest = self.protocol.clientRequestHandler.handle(requestJson, self);

    //copy the dsps so the filter could remove unnecessary dsps
    var dsps = self.dsps.slice(0);
    self.filterDsps(wrappedRequest, dsps);
    self.auction(wrappedRequest, dsps, self.timeout, function(responses) {
        var result = self.protocol.auctioneer.auction(wrappedRequest, responses, self);
        var winner = result[1];
        var loser = result[2];
        callback(null, self.protocol.clientResponseHandler.handle(request, result[0], self));
        //notice each dsp about the result
        winner.forEach(function (response) {
            winston.log('verbose', "send response to win dsp");
            self.notice_dsp(self.protocol.dspResponseHandler.handleWinResponse(wrappedRequest, response, self));
        });
        loser.forEach(function (response) {
            winston.log("verbose", "send response to fail dsp");
            self.notice_dsp(self.protocol.dspResponseHandler.handleFailResponse(wrappedRequest, response, self));
        });
    });
};

Engine.prototype.filterDsps = function(requestJSON, dsps){
    var self = this;
    self.protocol.filters.forEach(function(filter){
        filter.filter(requestJSON, dsps, self);
    });
};

/**
 * array[0] is the url to notice
 * array[1] is the json message
 * @param array
 */
Engine.prototype.notice_dsp = function(param){
    var urlobj = url.parse(param[0]);
    var notice_buffer = new Buffer(JSON.stringify(param[1]), "utf-8");
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
        winston.log('info', 'fail to notice url %s, error %s', param[0], JSON.stringify(error));
    });
    request.write(notice_buffer);
    winston.log("verbose", "notice dsp " + param[0]);
    request.end();
};

exports.Engine = Engine;