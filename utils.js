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

/**
 * load and initial an object from specified path, and check the function exists in this object
 * @param filePath
 * @param checkFuncs
 * @constructor
 */
utils.loadAndCheck = function(filePath, checkFuncs){
    var loadCls = require(filePath);
    var loadObj = new loadCls();
    checkFuncs.forEach(function(checkFunc){
        if (typeof(loadObj[checkFunc]) != "function") {
            throw new Error(loadObj + " doesn't have " + checkFunc + "()")
        }
    });
    return loadObj;
};

module.exports = utils;