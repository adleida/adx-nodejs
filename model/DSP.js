/**
 * Created by kliu on 06/06/2015.
 */

function DSP(bid_host, bid_path, bid_port, notice_host, notice_path, notice_port){
    var self = this;
    self.bid_host = bid_host;
    self.bid_path = bid_path;
    self.bid_port = bid_port;
    self.notice_host = notice_host;
    self.notice_path = notice_path;
    self.notice_port = notice_port;
}

var current_dsps = [];

function load_current_dsps(){
    if(current_dsps.length == 0){
        current_dsps = [
            new DSP("www.baidu.com", "/", 80, "", "/", 80),
            new DSP("www.sina.com", "/", 80, "", "/", 80),
            new DSP("localhost", "/", 3000, "localhost", "/notice", 3000)
        ];
    }
    return current_dsps;
}


exports.DSP = DSP;
exports.load_current_dsps = load_current_dsps;