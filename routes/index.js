var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'});
});

router.post("/clk", function (req, res) {
    if (req.body) {
        var request = req.body;
        var engine = req.app.get('engine');
        var config = req.app.get('config');
        engine.bid(request, config.timeout, function (error, response) {
            if (error) {
                res.end(JSON.stringify(error));
            } else {
                res.end(response);
            }
        });
    } else {
        res.end("empty request");
    }
});

module.exports = router;
