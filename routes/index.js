var express = require('express');
var router = express.Router();
var engine = require("../engine/engine");

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});


router.get('/clk', function (req, res, next) {
  engine.bid("", 1000, function(error, response){
    res.end(response);
  });
});

router.post("/clk", function(req, res){
  if(req.body){
    var request = req.body;
    engine.bid(JSON.stringify(request), 1000, function(error, response){
      if(error){

      }else{
        res.end(response);
      }
    });
  }
});

router.post('/notice', function(req, res, next){
  console.log("get notice info" );
  res.end("known");
});

module.exports = router;
