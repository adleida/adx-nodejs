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
            new DSP("192.168.1.244", "v1/bid/123", 6060, "192.168.1.244", "/v1/notice/123", 6060)
            //new DSP("123.57.70.242", "/v1/bid/123", 6060, "123.57.70.242", "/v1/notice/123", 6060)
            //new DSP("localhost", "/", 3000, "localhost", "/notice", 3000),
            //new DSP("www.sina.com", "/", 80, "", "/", 80)
        ];
    }
    return current_dsps;
}


exports.DSP = DSP;
exports.load_current_dsps = load_current_dsps;