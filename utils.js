/**
 * Created by kliu on 10/10/2015.
 */

var jsonschema = require("jsonschema");
var utils = {};

utils.validateJSON = function(json, schema){
    var result = jsonschema.validate(json, schema);
    if(result.errors.length == 0){
        return json;
    }else{
        throw new Error("message not valid, " + result.errors.join());
    }
};

utils.validateRawString = function(string, schema){
    var self = this;
    var json = JSON.parse(string);
    return self.validateJSON(json, schema);
};

module.exports = utils;