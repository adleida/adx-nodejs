/**
 * Created by kliu on 06/06/2015.
 */

var http = require("http");
var winston = require('winston');
var REGULAR_NOTICE = require("../model/notice").REGULAR_NOTICE;
var js = require("jsonfile");
var validator = require("jsonschema");
var url = require('url');
var uuid = require('node-uuid');
var fs = require("fs");


function Engine(rootDir){
    var self = this;
    self.state = self.ENGINE_STATE.STOPPED;
    self.dsps = [];
    self.schemas = {};
    self.rootDir = rootDir;
    self.filters = [];
    self.auctioneers = {};
};

Engine.prototype.ENGINE_STATE = {
    STOPPED : 0,
    RUNNING : 1
};


/**
 * initial the exchange according to the configuration file
 * including:
 * timeout
 * dsps
 * schema
 * @param config
 */
Engine.prototype.launch = function(config){
    var self = this;
    if(self.state == self.ENGINE_STATE.STOPPED){
        //initial the engine
        winston.log('info', "starting ad exchange engine...");
        
        self.protocol = config.protocol;
        self.timeout = config.timeout;
        winston.log("verbose", "timeout : %d", self.timeout);

        if(config.dsps){
            winston.log("verbose", "use dsps in configuration");
            winston.log("debug", config.dsps);
            self.dsps = config.dsps;
        }else{
            winston.log("verbose", "load dsps from database");
            self.dsps = [];
        }

        if(config.schemas){
            for(var rule in config.schemas){
                winston.log('verbose', "loading schema %s for rule %s", config.schemas[rule], rule);
                self.loadSchema(rule, self.rootDir + "/public/schemas/" + config.schemas[rule]);
            }
        }

        self.loadFilters();
        self.loadAuctioneers(config.auction);
        self.state = self.ENGINE_STATE.RUNNING;
    }else if(self.state == self.ENGINE_STATE.RUNNING){
        winston.error("ad exchange engine is already running");
        throw new Error("ad exchange engine already launched");
    }
};

/**
 * send bid request to dsp, if dsp returned full response before timeout, callback would be called to handle response, otherwise the connection would be aborted.
 * @param request_buffer
 * @param host
 * @param port
 * @param path
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
    var stopped = false;
    var rest = dsps.length;
    var request_buffer = new Buffer(JSON.stringify(request), "utf-8");

    winston.log('info', 'start new auction, bid request id is  %s...', request.id);
    dsps.forEach(function(dsp, idx){
        self.sendBid(request_buffer, dsp.bid_host, dsp.bid_port, dsp.bid_path, timeout, function(response){
            try{
                responses.push(self.validateResponse(response));
            }catch(error){
                winston.log('error', "dsp %s return invalid response", dsp.id);
            }
        });
    });

    setTimeout(function(){
        callback(responses);
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
    var self = this;
    var dsps = self.dsps;
    request.id = self.generateID();
    var auctionType = request.adunit.type;
    var auctioneer = self.auctioneers[auctionType];
    if(!auctioneer){
        winston.log("error", "engine doesn't have auctioneer for ad type " + auctionType);
        callback(new Error(), null);
    }else{
        self.auction(request, dsps, self.timeout, function(responses){
            var result = auctioneer.handle(request, responses, self);
            var adms = result[0];
            var winner = result[1];
            var loser = result[2];
            callback(null, self.composeBidResponse(request, adms));
            //notice each dsp about the result
            winner.forEach(function(response) {
                winston.log('verbose', 'notice dsp %s', response.did);
                self.notice_dsp(REGULAR_NOTICE.SUCCESS, response);
            });
            loser.forEach(function(response){
                winston.log("verbose", "notice dsp %s", response.did);
                self.notice_dsp(REGULAR_NOTICE.FAIL, response);
            });
        });
    }
};

Engine.prototype.filterDSP = function(request, dsps){
    var self = this;
    for(var i in self.filters){
        winston.log("debug", "filter using " + self.filters[i].name);
        dsps = self.filters[i].filter(request, dsps, self);
        winston.log("debug", "dsps left " + dsps);
    }
    return dsps;
}

/**
 * notice dsp about the bid result
 * @param notice
 * @param nurl
 */
Engine.prototype.notice_dsp = function(notice, response){
    var urlobj = url.parse(response.nurl);
    var notice_str = JSON.stringify(notice);
    var option = compose_post_option(notice_str, urlobj.hostname, urlobj.port, urlobj.path);
    var request = http.request(option);
    request.on('error', function(error){
        winston.log('info', 'fail to notice url %s, error %s', response.nurl, JSON.stringify(error));
    });
    notice.id = response.id;
    request.write(notice_str);
    request.end();
};

/**
 * compose the ad result according to the winner response
 * @param dsp
 * @param response
 * @returns {*}
 */
Engine.prototype.adResult = function(response){
    return new Buffer(JSON.stringify(response), "utf-8");
};

/**
 * select the winner from these responses
 * @param responses: array of [dsp_idx, response]
 */
Engine.prototype.winner = function(responses){
    if(responses.length == 0){
        return -1;
    }else{
        return 0;
    }
};

/**
 * load json schemas
 * @param rule
 * @param filePath
 */
Engine.prototype.loadSchema = function(rule, filePath){
    this.schemas[rule] = js.readFileSync(filePath);
};

Engine.prototype.validate = function(rule, data){
    return validator.validate(data, this.schemas[rule]);
};

Engine.prototype.loadFilters = function(){
    winston.log("info", "load filters");
    var self = this;
    var filterDir = self.rootDir + "/engine/filters";
    var filters = fs.readdirSync(filterDir).filter(function(filename){
        return filename.substr(-3) == ".js";
    });
    filters.forEach(function(filter){
        if(filter == "filterBase.js"){
            return;
        }
        try{
            winston.log("info", "load filter " + filter);
            var filterCls = require(filterDir + "/" + filter);
            var filterObj = new filterCls();
            if(typeof(filterObj.filter) != "function"){ throw new Error(filterObj + " doesn't have filter()")};
            winston.log("verbose", filterObj.loadMessage());
            if(filterObj.supportedVersion().indexOf(self.protocol) == -1){
                throw new Error(filter + " doesn't support protocol version " + self.protocol_version);
            }
            filterObj.onLoad();
            self.filters.push(filterObj);
        }catch(error){
            winston.log("error", "fail to load filter " + filter, error);
        }
    });
};

Engine.prototype.loadAuctioneers = function(auction){
    var self = this;
    for(var type in auction){
        self.loadAuctioneer(type, auction[type]);
    }
};

Engine.prototype.loadAuctioneer = function(type, auctioneer){
    var self = this;
    var file = self.rootDir + "/engine/auctioneers/" + auctioneer;
    try{
        winston.log("info", "for auction type " + type + " load auctioneer " + auctioneer);
        var auctionCls = require(file);
        var auctionObj = new auctionCls();
        if(auctionObj.supportedVersion().indexOf(self.protocol) == -1){
            throw new Error(auctioneer + " doesn't support protocol version " + self.protocol_version);
        }
        self.auctioneers[type] = auctionObj;
    }catch(error){
        winston.log("error", "fail to load auctioneer " + auctioneer, error);
    }
};

Engine.prototype.composeBidResponse = function(request, adms){
    var self = this;
    var response = {};
    response.adm = self.transferCreativesToShows(adms);
    response.is_test = request.is_test;
    return response;
};

Engine.prototype.transferCreativesToShows = function(adms){
    adms.forEach(function(adm){
        adm.m_id = adm.id;
        //adm.data = {};
        delete adm.price;
    });
    return adms;
};

exports.Engine = Engine;