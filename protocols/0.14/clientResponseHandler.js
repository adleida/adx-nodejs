/**
 * Created by kan on 2015/10/9.
 */

function ClientResponseHandler(){

}


ClientResponseHandler.prototype.handle = function(request, result){
    var self = this;
    var response = {};
    response.adm = self.transferCreativesToShows(result);
    response.is_test = request.is_test;
    return response;
};

ClientResponseHandler.prototype.handleInvalidBidRequest = function(request, error, engine){

};

ClientResponseHandler.prototype.transferCreativesToShows = function(adms){
    adms.forEach(function(adm){
        adm.m_id = adm.id;
        //adm.data = {};
        delete adm.price;
    });
    return adms;
};

module.exports = ClientResponseHandler;