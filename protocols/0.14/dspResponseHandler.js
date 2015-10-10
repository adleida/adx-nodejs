/**
 * Created by kliu on 10/10/2015.
 */

function Response(){

};

Response.prototype.successResponseJSON = function(request, result, engine){

};

Response.prototype.errorResponseJSON = function(request, error, engine){
    return {
        'id' : request.id,
        'adm' : [],
        'error' : error
    };
};

Response.prototype.handleWinResponse = function(request, response, engine){
    return
    [
        response.nurl,
        {
            'id' : request.id,
            "handleWinResponse" : ''
        }
    ];
};

Response.prototype.handleFailResponse = function(request, response, engine){
    return
    [
        response.nurl,
        {
            'id' : request.id,
            'lose' : ''
        }
    ];
}

module.exports = Response;