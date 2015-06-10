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

once the exchange started, it will run on port 3000. client may send bid request to http://ip:3000/clk, the exchange will resend these requests to dsps you specified, select the final winner and return the result to the client and notice dsps about the result.

## Configuration
    
## Schema
