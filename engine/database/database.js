/**
 * Created by kliu on 10/06/2015.
 */
//var mongoClient = require("./mongo/mongoAdapter").
function Database(dbEnum){
    var self = this;
    self.dbEnum = dbEnum;
    switch (self.dbEnum){
        case Database.DB_ENUM.MONGO:
            self.adapter = new require("./mongo/mongoAdapter").MongoAdapter();
            break;
        default :
            throw new Error("unknown database type: " + dbEnum);
    }
}

Database.DB_ENUM = {
    MONGO : 0
};

Database.prototype.connectSync = function(db, user, passwd){
    var self = this;
    return self.adapter.connectAsync(dbUrl, user, passwd);
};

Database.prototype.connectAsync = function(dbUrl, user, passwd, callback){
    var self = this;

};

Database.prototype.querySync = function(params){

};

Database.prototype.queryAsync = function(params, callback){

};