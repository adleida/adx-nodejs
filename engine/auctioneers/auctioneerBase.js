/**
 * Created by kliu on 12/06/2015.
 */

function AuctioneerBase(){
}
/**
 * should return the acution type that the auctioneer could handle
 */
AuctioneerBase.prototype.auctionType = function(){

};

AuctioneerBase.prototype.onLoad = function(){

};

AuctioneerBase.prototype.loadMessage = function(){

};

AuctioneerBase.prototype.supportedVersion = function(){
    return [];
};

/**
 * select the winner and loser
 * @param request
 * @param responses
 * @param engine
 */
AuctioneerBase.prototype.handle = function(request, responses, engine){

};

module.exports = AuctioneerBase;