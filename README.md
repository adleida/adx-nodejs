Node-adexchange
===
An ad exchange center written in nodejs.
一个基于nodejs的ad exchange.
## Installation安装
* download the code 下载源码
 
        git clone https://github.com/adleida/adx-nodejs.git

* install packages 安装依赖库

        npm install
        
* prepare configuration file 调试配置文件,可以先复制配置文件模板

        cp config/app_config.template.yaml config/app_config.yaml
    
    about how to configure the parameters, please refer to 
* start exchange 启动exchange

        npm start
    or
    
        node bin/www
        
## Usage 使用方法

once the exchange started, it will run on port 3000. client may send bid request to **http://ip:3000/clk**, the exchange will resend these requests to dsps you specified, select the final winner and return the result to the client and notice dsps about the result.

当exchange启动后，它将在3000端口运行。发起竞价方可以将bid request发向 **http://ip:3000/clk**，exchange将会向所有注册dsp发出竞拍，选出最后获胜者返回发起竞价方最后广告方案，同时通知DSP竞价结果。

## Configuration 配置
The configuration file has several parts: 配置文件有几个部分组成
### engine
####timeout
The max time that exchange would wait for DSP's reponse in ms.
####dsps
If dsps were presented in the configuration file ,the exchange would only load these dsps
each dsp should have:

* bid_host
* bid_port
* bid_path

### log_level
set the log level for the exchange system, you may use:

* debug
* verbose
* info
* warn
* error

####shemas
specified the json schema to validate the request from client and response from DSP, you should only write down the filename, exchange will try to load them under /public/schemas/

## Schema
All shema files should be placed under /public/shemas.
