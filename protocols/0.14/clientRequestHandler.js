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
ClientRequestHandler.prototype.handleClientRequest = function(requestJson, app){
    return requestJson;
};

exports.ClientRequestHandler = ClientRequestHandler;