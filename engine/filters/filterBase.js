/**
 * Created by kliu on 11/06/2015.
 */

/**
 * the base class for all filters
 * @constructor
 */
function FilterBase(){
    this.name = "baseFilter";
};

/**
 * load message will be print in the log 'info'
 */
FilterBase.prototype.loadMessage = function(){
    return "filter base, actually do nothing"
};

/**
 * this will be called when egnine load this filter
 */
FilterBase.prototype.onLoad = function(){

};

FilterBase.prototype.supportedVersion = function(){
    return [];
};

/**
 * core function of filter
 * this function should return filtered dsp array
 * @param request
 * @param dsps
 * @param engine
 */
FilterBase.prototype.filter = function(request, dsps, engine){
    return dsps;
};

module.exports = FilterBase;