/**
 * Created by kan on 2015/10/9.
 */

/**
 *
 * @constructor
 */
function ClientRequestHandler(){

};

/**
 * get the parsed request json, and return the request that the exchange would send it to dsps
 * @param requestJson
 * @param app
 */
ClientRequestHandler.prototype.handle = function(requestJson, engine){
    return requestJson;
};

module.exports = ClientRequestHandler;