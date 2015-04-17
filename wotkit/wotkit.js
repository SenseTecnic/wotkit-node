module.exports = function(RED) {
    "use strict";
    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var express = require("express");
    var getBody = require('raw-body');
    var mustache = require("mustache");
    var querystring = require("querystring");

    var cors = require('cors');
    var jsonParser = express.json();
    var urlencParser = express.urlencoded();

    function rawBodyParser(req, res, next) {
        if (req._body) { return next(); }
        req.body = "";
        req._body = true;
        getBody(req, {
            limit: '1mb',
            length: req.headers['content-length'],
            encoding: 'utf8'
        }, function (err, buf) {
            if (err) { return next(err); }
            req.body = buf;
            next();
        });
    }

    /*
     * Node for WoTKit Sensor Input
     */
    function WotkitDataIn(n) {

        RED.nodes.createNode(this,n);
        var node = this;

        if (!n.sensor) {
            node.error("No sensor specified");
            return;
        }

        this.login = RED.nodes.getNode(n.login);// Retrieve the config node
        if (!this.login) {
            node.error("No credentials specified");
            return;
        }

        this.sensor = n.sensor;
        this.url = this.login.url || "http://wotkit.sensetecnic.com";
        this.timeout = (n.timeout || 5) * (n.timeoutUnits === "minutes" ? 60000:1000);
        this.querytimeout = this.timeout + 1000;

        this.lastId = null;

        var method = "GET";
        var msg = {};


        var url = this.url+"/api/sensors/"+node.sensor+"/data?before="+node.querytimeout;
        node.pollWotkitData = setInterval(function() {
            doHTTPRequest(url, method, node, msg);
        },this.timeout);

        this.on('close', function(){
            if (this.pollWotkitData != null) {
                clearInterval(this.pollWotkitData);
            }
        });
    }

    RED.nodes.registerType("wotkit data-in",WotkitDataIn);
  
    /*
     * Node for WoTKit Sensor Output
     */
    function WotkitDataOut(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        if (!n.sensor) {
            node.error("No sensor specified");
            return;
        }

        this.login = RED.nodes.getNode(n.login);// Retrieve the config node
        if (!this.login) {
            node.error("No credentials specified");
            return;
        }
        this.sensor = n.sensor;
        this.url = this.login.url || "http://wotkit.sensetecnic.com";
        this.on("input",function(msg) {

            // Accepted formats: Formated Object. 
            // String, number: will create a {value:msg.payload} object.
            // Json string "{}" will be made an object
            if (typeof msg.payload === "number"){
                msg.payload = {value: msg.payload};
            } else if (typeof msg.payload === "string"){
                try { //if in JSON format
                    msg.payload = JSON.parse(msg.payload);
                } catch (e) {
                    //TODO: validate string (brackets, quotes, etc.)
                    msg.payload = {message: msg.payload};
                }
            } //else if object carry on.

            //post upstream msg to wotkit
            var url = node.url+"/api/sensors/"+node.sensor+"/data";
            var method = "POST";
            doHTTPRequest(url, method, node, msg);
        });
    }
    RED.nodes.registerType("wotkit data-out",WotkitDataOut);


    /*
     * Node for WoTKit Control Output
     */

    function WotkitControlOut(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        if (!n.sensor) {
            node.error("No sensor specified");
            return;
        }

        this.login = RED.nodes.getNode(n.login);// Retrieve the config node
        if (!this.login) {
            node.error("No credentials specified");
            return;
        }
        this.sensor = n.sensor;
        this.url = this.login.url || "http://wotkit.sensetecnic.com";
        this.on("input",function(msg) {

            // Accepted formats: Formated Object. 
            // String, number: will create a {slider:msg.payload} object.
            // Json string "{}" will be made an object
            // NOTE: This is to support JSON posting in the near future.
            if (typeof msg.payload === "number"){
                msg.payload = {slider: msg.payload};
            } else if (typeof msg.payload === "string"){
                try { //if in JSON format
                    msg.payload = JSON.parse(msg.payload);
                } catch (e) {
                    msg.payload = {message: msg.payload};
                }
            } //else if object carry on.

            var urlparams = getUrlParamters(msg.payload);
            msg.payload = null; //in the future we can use this to POST a JSON Object
            msg.headers = {'content-type': 'application/x-www-form-urlencoded'};

            //post upstream message to wotkit, currently form-urlencoded
            var url = node.url+"/api/sensors/"+node.sensor+"/message?"+urlparams;
            var method = "POST";
            doHTTPRequest(url, method, node, msg);
        });
    }
    RED.nodes.registerType("wotkit control-out",WotkitControlOut);


     /*
     * Node for WoTKit Control Sensor Input
     */
    function WotkitControlIn(n) {

        RED.nodes.createNode(this,n);
        var node = this;

        if (!n.sensor) {
            node.error("No sensor specified");
            return;
        }

        this.login = RED.nodes.getNode(n.login);// Retrieve the config node
        if (!this.login) {
            node.error("No credentials specified");
            return;
        }

        this.sensor = n.sensor;
        this.url = this.login.url || "http://wotkit.sensetecnic.com";
        this.querytimeout = n.timeout; //already in seconds.
        this.active = true;
        this.name = n.name;

        //register listener
        var url = node.url+"/api/v1/control/sub/"+node.sensor;
        var method = "POST";
        var msg = {'headers' : {'content-type': 'application/json'}};
        var subscription = null;

        node.pollWotkitEvents = function pullControl() {    
                                 //pull when we have the subscription
                                 var url = node.url+"/api/control/sub/"+subscription+"?wait="+node.querytimeout;
                                 var method = "GET";
                                 var msg = {};
                                 doHTTPRequest(url, method, node, msg, function() { node.pollWotkitEvents() });    
                               };

        doHTTPRequest(url, method, node, msg, function(msg){
                             var data = JSON.parse(msg.data);
                             subscription = data.subscription;
                             node.active = true; //activate recursive pull
                             node.pollWotkitEvents();
                });     



        this.on('close', function(){
            this.active = false; //deactivate recursive pull
        });

    }

    RED.nodes.registerType("wotkit control-in",WotkitControlIn);

    /*
     * Node for WoTKit Credentials
     */
    function WotkitCredentialsNode(n) {
        RED.nodes.createNode(this,n);
        this.url = n.url;
        if (this.credentials) {
            this.username = this.credentials.user;
            this.password = this.credentials.password; 
        }
    }

    RED.nodes.registerType("wotkit-credentials", WotkitCredentialsNode, {
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });

    /*
     * Utility functions for Http Requests
     */

    /** 
      * Parse JSON as parameters and encode to append to URL
      * @param	data	Required: Data to parse
      * @return		A String of parameters (key=value&key=value)
     **/     
    function getUrlParamters(data) {
        var params = Object.keys(data).map(function(k) {
                     //Only string and number parameters, nested objects will be ignored
                     if (typeof data[k] === 'string') { 
                         return encodeURIComponent(k) + '=' + encodeURIComponent(data[k])
                     } else if (typeof data[k] ==='number') {
                         return encodeURIComponent(k) + '=' + data[k]
                     }
                    }).join('&');
        return params;
    }

    /**
    *  Makes a call to the WoTKit API
    *  @param	url		Required: The complete URL 
    *  @param	method		Required: The HTTP Method of this request
    *  @param	node 		Required: The node object. Used for credentials, name and debug messages
    *  @param	msg 		msg.payload (data to be sent), msg.headers (any headers)
    *  @param	callback 	If given this function will be called on success.
    *  @return		        The msg object with the response from the server.
    **/
    function doHTTPRequest (url, method, node, msg, callback) {

        var opts = urllib.parse(url);
        opts.method = method;        
        opts.headers = msg.headers || {};

        /*Normalize headers*/
        if (msg.headers) {
            for (var v in msg.headers) {
                if (msg.headers.hasOwnProperty(v)) {
                    var name = v.toLowerCase();
                    if (name !== "content-type" && name !== "content-length") {
                        // only normalise the known headers used later in this
                        // function. Otherwise leave them alone.
                        name = v;
                    }
                    opts.headers[name] = msg.headers[v];
                }
            }
        } 

        if (node.login.credentials && node.login.credentials.user) {
            opts.auth = node.login.credentials.user+":"+(node.login.credentials.password||"");
        }

        var payload = null;
    
        if (msg.payload && (method == "POST" || method == "PUT") ) {
            payload = JSON.stringify(msg.payload);
            if (opts.headers['content-type'] == null) {
                opts.headers['content-type'] = "application/json";
            }
        }

        var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
                
            var result = "";
            res.setEncoding('utf8');
            msg.statusCode = res.statusCode;
            msg.headers = res.headers;
                
            res.on('data',function(chunk) {
                result += chunk;
            });
            res.on('end',function() {
                msg.payload = JSON.stringify(result);
                msg.data = result; 
                node.status({});
                    
                if (res.statusCode != 201 && res.statusCode != 200){
                    node.error ("Node "+node.name + ": "+msg.payload);
                    node.active = false;
                } else  if (opts.method === 'GET') { //TODO: this only needs to be done if a get
                    var json = JSON.parse(result) || {};

                    json.forEach(function(item, index){

                        if (node.lastId == null  || node.lastId < item.id){
                            // payload.push(item);
                            if (index === json.length-1){
                                node.lastId = item.id;
                            }
                            //Clear sensor data.
                            delete item.id;
                            delete item["sensor_id"];
                            delete item["sensor_name"];
                            msg.payload = item;
                            node.send(msg);
                        }
                    });
                } else { node.send (msg); }
                if (callback && node.active) { //only if node is not closed or no error
                    callback(msg);
                }

            });
            }).on('error', function(e){
                node.warn ("Got Error: "+e.message);
            });

        if (payload) {
            req.write(payload);
        }
        req.end();
        
        return msg;

    }

};
