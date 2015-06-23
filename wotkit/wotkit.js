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
        //var url = "http://localhost/wotkit-php/php-client/example-error.php"; //REplicating 400 error
        node.pollWotkitData = setInterval(function() {
            doHTTPRequest(url, method, node, msg);
        },this.timeout);

        this.on('close', function(){
            if (this.pollWotkitData != null) {
                clearInterval(this.pollWotkitData);
            }
            node.status({});
        });
    }

    RED.nodes.registerType("wotkit in",WotkitDataIn);

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

        this.on('close', function(){
            node.status({});
        });

    }
    RED.nodes.registerType("wotkit out",WotkitDataOut);


    /*
    * Node for WotKit Raw Data Retrieve
    */

    function WotkitDataRetrieve(n) {
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

      var beforeType = n.beforeType === "elements" ? "beforeE" : "before";
      var before = beforeType === "before"? n.before * 1000 : n.before;
      var method = "GET";
      var msg = {};
      var url = this.url+"/api/sensors/"+node.sensor+"/data?"+beforeType+"="+before;

      this.on('input',function(msg){
        doHTTPRequest(url, method, node, msg);
      });

      this.on('close', function(){
          node.status({});
      });

    }
    RED.nodes.registerType("wotkit data", WotkitDataRetrieve);


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
        this.on('close', function(){
            node.status({});
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
        this.name = n.name;

        //register listener
        var url = node.url+"/api/v1/control/sub/"+node.sensor;
        var method = "POST";
        var msg = {'headers' : {'content-type': 'application/json'}};
        var subscription = null;

        //Subscribe
        doHTTPRequest(url, method, node, msg, function(msg){
            var data = JSON.parse(msg.payload);
            if (data !== null) {
              subscription = data.subscription;
              //pull events when finished
              node.pollWotkitEvents = setTimeout (function pollEvents(){
                var url = node.url+"/api/control/sub/"+subscription+"?wait="+node.querytimeout;
                var method = "GET";
                var msg = {};
                node.WoTKitRequest = doHTTPRequest(url, method, node, msg, function() {
                                                                               node.pollWotkitEvents = setTimeout(pollEvents,0)
                                                                           });
              });
            } else {
              node.error ("Wrong credentials or non-existent sensor.");
            }
        });

        this.on('close', function(){
            //clean up
            if (this.pollWotkitEvents != null ) {
                clearTimeout( this.pollWotkitEvents );
                this.pollWotkitEvents = null;
            }
            //abort any requests ongoing
            this.WoTKitRequest.abort();
            node.status({});
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
        if (isEmpty(data)) return "";
        var params = Object.keys(data).map(function(k) {
                     //Only string and number parameters, nested objects will be ignored
                     if (typeof data[k] === 'string') {
                         return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
                     } else if (typeof data[k] ==='number') {
                         return encodeURIComponent(k) + '=' + data[k];
                     }
                    }).join('&');
        return params;

    }

    /**
    * Checks if an object has keys.
    * @param obj Required: an object (or non-object)
    * @return true if empty, false if it has keys
    **/
    function isEmpty(obj) {
        for(var prop in obj) {
            if(obj.hasOwnProperty(prop))
                return false;
        }
        return true;
    }

    /**
    *  Makes a call to the WoTKit API
    *  @param	url		Required: The complete URL
    *  @param	method		Required: The HTTP Method of this request
    *  @param	node 		Required: The node object. Used for credentials, name and debug messages
    *  @param	msg 		msg.payload (data to be sent), msg.headers (any headers)
    *  @param	callback 	If given this function will be called on success.
    *  @return 			The request object
    **/
    function doHTTPRequest (url, method, node, msg, callback) {

        var opts = urllib.parse(url);
        opts.method = method;
        opts.headers = msg.headers || {};
        var payload = null;

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
                msg.payload = result;

                if (res.statusCode != 201 && res.statusCode != 200){
                    node.warn ("WoTKit Error: "+ msg.payload);
                    node.log("WoTkit Error:\n" +msg.payload);
                    node.status({fill:"red",shape:"dot",text:"WoTkit Error: "+res.statusCode});
                } else  if (opts.method === 'GET') { // GET CASE
                    var json = JSON.parse(result) || {};

                    json.forEach(function(item, index){
                        if (node.lastId == null  || node.lastId < item.id){
                            if (index === json.length-1){
                                node.lastId = item.id;
                            }
                            //Clear sensor data.
                            delete item.id;
                            delete item["sensor_id"];
                            delete item["sensor_name"];
                            msg.payload = item;
                            node.send(msg); //send an event for each item
                        }
                    });
                    node.status({fill:"green",shape:"dot",text:"OK"});
                } else { // POST CASE
                    node.send (msg); //otherwise send an event for the received message
                    node.status({fill:"green",shape:"dot",text:"OK"});
                }

                if ( typeof callback === 'function' && callback != null ) {
                    callback(msg);
                }

            });

          }).on('error', function(e){
                if (e.code == 'ECONNRESET'){ //connection hung up (mainly due to closing our connection)
                    node.warn ("WoTKit hung up. OK when deploying a new flow.");
                    node.status({fill:"red",shape:"dot",text:"WoTKit hung up."});
                } else {
                    node.warn ("Got Error: "+e.message);
                    node.status({fill:"red",shape:"dot",text:"Error."});
                }

            });

        if (payload) {
            req.write(payload);
        }

        req.end();

        return req; //So we can manage this long-pull request later (e.g. close it if needed)

    }

};
