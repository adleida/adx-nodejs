/**
 * Created by kliu on 10/06/2015.
 */

var mongodb = require("mongodb");
var winston = require("winston");

function MongoAdapter(){
    this.mongoClient = mongodb.MongoClient;
    this.db = null;
}
MongoAdapter.prototype.connectAsync = function(url, username, password){
    var self = this;
    var result = undefined;
    self.mongoClient.connect(url, function(err, db){
        if(err){
            winston.log("info", "fail to connect mongo db", err);
            result = false;
        }else{
            winston.log("info", "connected to mongo db", url);
            result = true;
            self.db = db;
        }
    });

    waitUntil(function(){
        return (typeof(result) != "undefined");
    });

    return result;
}

function waitUntil(untilTrue){
    while(!untilTrue()){
        process.nextTick(waitUntil);
    }
}

exports.MongoAdapter = MongoAdapter;