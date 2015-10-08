/**
 * Created by kliu on 08/06/2015.
 */

var RESPONSE = new function(){
    var self = this;
    self.UNRECOGNIZED_REQUEST = {};
    self.PROTOCOL_VERSION_NOT_SUPPORTED = {
        error : {
            code : 2,
            detail : 'protocol version not supported'
        }
    };
    self.PROTOCOL_VERSION_NOT_SUPPORTED_STR = JSON.stringify(self.PROTOCOL_VERSION_NOT_SUPPORTED);
};

RESPONSE.ERROR_RESPONSE = function(error){
    return {
        "adm" :[],
        "error" : error
    };
};

exports.RESPONSE = RESPONSE;

