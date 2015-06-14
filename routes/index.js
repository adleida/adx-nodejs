var express = require('express');
var router = express.Router();
var winston = require('winston');
var RESPONSE = require("../model/response").RESPONSE;
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

module.exports = router;
