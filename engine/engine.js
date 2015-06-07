/**
 * Created by kliu on 06/06/2015.
 */

var http = require("http");
var load_current_dsps = require("../model/DSP").load_current_dsps;
var REGULAR_NOTICE = require("../model/notice").REGULAR_NOTICE;


//All the DSP current available.
var CURRENT_DSPS = load_current_dsps();

function compose_post_option(request, host, port, path){
    return {
        method : "POST",
        hostname: host,
        port: port,
        path: path,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": request.length
        }
    };
}

/**
 * send the request to each dsp in the list
 * then call the callback with arry of [dsp_idx : response] which returned earlier than the timeout
 * current version use string to concat http messages, if there're encoding problem we need to use buffer
 * @param request   request content
 * @param dsps      list of dsp url
 * @param timeout   in ms
 * @param callback  function(responses)
 */
function auction_to_dsp(request, dsps, timeout, callback){
    var responses = [];
    var stopped = false;
    var rest_to_send = CURRENT_DSPS.length;

    //POST bid request to each DSP
    dsps.forEach(function (dsp, idx) {
        var response = '';
        var options = compose_post_option(request, dsp.bid_host, dsp.bid_port, dsp.bid_path);

        //concat post message, but if this auction is already done (stopped) shutdown the connection
        var req = http.request(options, function (res) {
            res.on('data', function (data) {
                if (stopped) {
                    res.destroy();
                } else {
                    response += data;
                }
            });

            res.on("end", function () {
                if(stopped){
                    //do nothing
                }else{
                    responses.push([idx, response]);
                    if (--rest_to_send == 0) {
                        stopped = true;
                        callback(responses);
                    }
                }
            });
        });

        req.on('error', function(error){
            console.log(error);
        });

        req.write(request);
        req.end();
    });

    //timeout for the whole bid auction
    setTimeout(function(){
        if(!stopped){
            stopped = true;
            callback(responses);
        }
    }, timeout);
}

function bid(request, timeout, callback){
    auction_to_dsp(request, CURRENT_DSPS, timeout, function(responses){
        var win_idx = winner(responses);
        if(win_idx != -1){
            callback(null, responses[win_idx][1]);
        }else{
            callback({"fail" : "fail"}, "failed to get bid result");
        }

        responses.forEach(function(response, idx){
            if(win_idx == idx){
                notice_dsp(REGULAR_NOTICE.SUCCESS, CURRENT_DSPS[response[0]]);
            }else{
                notice_dsp(REGULAR_NOTICE.FAIL, CURRENT_DSPS[response[0]]);
            }
        });
    });
}

function notice_dsp(notice, dsp){
    var options = compose_post_option(notice, dsp.notice_host, dsp.notice_port, dsp.notice_path);
    var request = http.request(options);
    request.write(notice);
    request.on('error', function(error){
       console.log(error);
    });
    request.end();
}

function winner(responses){
    if(responses.length == 0){
        return -1;
    }else{
        return 0;
    }
}

exports.bid = bid;