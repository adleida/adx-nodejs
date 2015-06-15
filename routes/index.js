var express = require('express');
var router = express.Router();
var winston = require('winston');
var RESPONSE = require("../model/response").RESPONSE;
var url = require("url");

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'});
});

router.post("/clk", function (req, res) {
    var engine = req.app.get('engine');

    //protocol version check
    var protocol_version = engine.protocol_version;
    if((! req.headers.protocol_version) || (req.headers.protocol_version != protocol_version)){
        res.end(RESPONSE.PROTOCOL_VERSION_NOT_SUPPORTED_STR);
        return;
    }

    if (req.body) {
        var request = req.body;


        var validateResult = engine.validate("request", request);
        if(validateResult.errors.length > 0){
            winston.log("verbose", "request not valide");
            winston.log("debug", request);
            res.end(validateResult.errors.join(" "));
        }

        var config = req.app.get('config');
        engine.bid(request, function (error, response) {
            if (error) {
                res.end(JSON.stringify(error));
            } else {
                res.end(JSON.stringify(response));
            }
        });
    } else {
        res.end("empty request");
    }
});

router.post("/config", function(req, res){
    var engine = req.app.get('engine');
    winston.log("info", "reconfigure engine");
    if(req.body){
        winston.log("verbose", "configure engine dsp list");
        var requestData = req.body;
        if(requestData.dsps){
            engine.dsps = [];
            requestData.dsps.forEach(function(requestDsp){
                var burlObj = url.parse(requestDsp.burl);
                engine.dsps.push({
                    bid_host: burlObj.hostname,
                    bid_port : burlObj.port,
                    bid_path : burlObj.path
                });
            });
        }
        winston.log("verbose", "engine dsp list now are ", engine.dsps);
    }
    res.end();
});

module.exports = router;
