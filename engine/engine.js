/**
 * Created by kliu on 06/06/2015.
 */

var http = require("http");
var winston = require('winston');
var load_current_dsps = require("../model/DSP").load_current_dsps;
var REGULAR_NOTICE = require("../model/notice").REGULAR_NOTICE;
var js = require("jsonfile");
var validator = require("jsonschema");

function compose_post_option(request, host, port, path){
    return {
        method : "POST",
        hostname: host,
        port: port,
        path: path,
        headers: {
            //"Content-Type": "application/json",
            "Content-Length": request.length
        }
    };
}

function Engine(rootDir){
    var self = this;
    self.state = 0;
    self.dsps = [];
    self.schemas = {};
    self.rootDir = rootDir;
};

Engine.prototype.ENGINE_STATE = {
    STOPPED : 0,
    RUNNING : 1
};

Engine.prototype.launch = function(config){
    var self = this;
    if(self.state == self.ENGINE_STATE.STOPPED){
        //initial the engine
        winston.log('info', "starting ad exchange engine");

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
        self.state = self.ENGINE_STATE.RUNNING;
    }else if(self.state == self.ENGINE_STATE.RUNNING){
        winston.warn("ad exchange engine is already running");
    }
};

/**
 * hold an auction for dsps, responses that returned in less than timeout are valid
 * @param request
 * @param dsps
 * @param timeout
 * @param callback
 */
Engine.prototype.auction = function(request, dsps, timeout, callback){
    var self = this;
    var responses = [];
    var stopped = false;
    var rest = dsps.length;
    var request_str = JSON.stringify(request);

    winston.log('info', 'start new auction %s', request.id);
    dsps.forEach(function(dsp, idx){
        var response = '';
        var options = compose_post_option(request_str, dsp.bid_host, dsp.bid_port, dsp.bid_path);

        var req = http.request(options, function(res){
            res.on('data', function (data) {
                if (stopped) {
                    res.destroy();
                } else {
                    response += data;
                }
            });

            res.on("end", function () {
                if(stopped){
                    winston.log('debug', 'dsp %s returned bid response, however the auction already ends', dsp.id);
                }else{
                    winston.log('verbose', 'dsp %s returned bid response', dsp.id);
                    winston.log('debug', 'response: %s', response);

                    var validateResult = self.validate('response', JSON.parse(response));
                    if(validateResult.errors.length == 0){
                        responses.push([idx, response]);
                    }else{
                        winston.log('info', "dsp %s returned invalid response", dsp.id, validateResult.errors.join(" "));
                    }
                    if (--rest == 0) {
                        stopped = true;
                        callback(responses);
                    }
                }
            });
        });

        winston.log('verbose', 'send bid request to dsp %s ==> %s:%s%s', dsp.id, dsp.bid_host, dsp.bid_port, dsp.bid_path);
        winston.log('debug', 'request: ', request);
        req.on('error', function(error){
            winston.log('info','error in sending bid request to %s', dsp.id)
        });
        req.write(request_str);
        req.end();
    });
    setTimeout(function(){
        if(!stopped){
            winston.log('info', 'auction %s timeout', request.id);
            stopped = true;
            callback(responses);
        }
    }, timeout);
};

Engine.prototype.generateID = function(){
    return Math.random().toString();
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
    self.auction(request, dsps, self.timeout, function(responses){
        var winner = self.winner(responses);
        if(winner == -1){
            winston.log('info', 'auction %s has no available bids', request.id);
            callback({"error":"no available bids"}, "no available bids");
        }else{
            winston.log('verbose','dsp %s has won bid %s', dsps[responses[winner][0]].id, request.id);
            winston.log('debug', 'winner response: ', responses[winner][1]);
            var result = self.adResult(dsps[responses[winner][0]], responses[winner][1]);
            callback(null, result);
        }

        //notice each dsp about the result
        responses.forEach(function(response, idx) {
            winston.log('verbose', 'notice dsp %s', dsps[response[0]].id);
            if(winner == idx){
                self.notice_dsp(REGULAR_NOTICE.SUCCESS, dsps[response[0]]);
            }else{
                self.notice_dsp(REGULAR_NOTICE.FAIL, dsps[response[0]]);
            }
        });
    });
};

Engine.prototype.notice_dsp = function(notice, dsp){
    var option = compose_post_option(notice, dsp.notice_host, dsp.notice_port, dsp.notice_path);
    var request = http.request(option);
    request.on('error', function(error){
        winston.log('info', 'fail to notice dsp %s, error %s', dsp.id, JSON.stringify(error));
    })
    request.write(notice);
    request.end();
};

Engine.prototype.adResult = function(dsp, response){
    return response;
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

exports.Engine = Engine;