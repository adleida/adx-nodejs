Node-adexchange
===
An ad-exchange center written in nodejs
## Installation
* download the code
 
        git clone https://github.com/adleida/adx-nodejs.git

* install packages

        npm install
        
* prepare configuration file

        cp config/app_config.template.yaml config/app_config.yaml
    
    about how to configure the parameters, please refer to 
* start exchange

        npm start
    or
    
        node bin/www
        
## Usage

once the exchange started, it will run on port 3000. client may send bid request to **http://ip:3000/clk**, the exchange will resend these requests to dsps you specified, select the final winner and return the result to the client and notice dsps about the result.

## Configuration
The configuration file has several parts:
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
All shema file should be placed under /public/shemas.
