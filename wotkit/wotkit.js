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


    function WotkitIn(n) {

        RED.nodes.createNode(this,n);
        this.sensor = n.sensor;
        this.timeout = n.timeout;
        this.lastId = null;
        var node = this;
        var sensor_name = node.sensor;
        var timeout = node.timeout;
        var query_timeout = parseInt(timeout)+1000; //query for extra second, then filter out by id and timestamp
        this.login = RED.nodes.getNode(n.login);// Retrieve the config node
        //TODO: if node is deleted, should stop interval, if interval value is modified , update that
        var url;
        if (this.login){
            url = "http://wotkit.sensetecnic.com/api/sensors/"+sensor_name+"/data?before="+query_timeout;
            var method = "GET";
            node.pollWotkitData = setInterval(function() {
                HTTPGetRequest(url, node); 
            },timeout);
        }

    }
    RED.nodes.registerType("wotkit in",WotkitIn,{
    });

    WotkitIn.prototype.close = function(){
        if (this.pollWotkitData != null) {
            clearInterval(this.pollWotkitData);
        }
    }


    function WotkitOut(n) {
        RED.nodes.createNode(this,n);
        var node = this;
        this.sensor = n.sensor;
        // Retrieve the config node
        this.login = RED.nodes.getNode(n.login);
        this.on("input",function(msg) {
            //post upstream msg to wotkit
            var sensor_name = node.sensor;

            var url = "http://wotkit.sensetecnic.com/api/sensors/"+sensor_name+"/data";
            var method = "POST";
            makeHTTPRequest(url, method, node, msg);
        });
    }
    RED.nodes.registerType("wotkit out",WotkitOut,{

    });

    function WotkitCredentialsNode(n) {
        RED.nodes.createNode(this,n);
        this.name = n.name;
        this.user = n.user;
        this.password = n.password;
    }
    RED.nodes.registerType("wotkit-credentials", WotkitCredentialsNode, {
        credentials: {
            user: {type:"text"},
            password: {type: "password"}
        }
    });

    function HTTPGetRequest(url, node){
        var opts = urllib.parse(url);
            opts.method = "GET";
            
            if (node.login.credentials && node.login.credentials.user) {
                opts.auth = node.login.credentials.user+":"+(node.login.credentials.password||"");
            }

            var req = ((/^https/.test(url))?https:http).get(opts, function(res){
                var bodyChunks = [];
                res.on('data', function(chunk) {
                    // You can process streamed parts here...
                    bodyChunks.push(chunk);
                }).on('end', function() {
                    var msg = {};
                    var chunk=Buffer.concat(bodyChunks);
                    var message = chunk.toString('utf8');
                    var payload = [];
                    var json = JSON.parse(chunk.toString('utf8'));
                    if (res.statusCode !=200){
                        node.error ("Node "+node.name + ": "+message);
                        clearInterval(node.pollWotkitData);
                    }else{
                        json.forEach(function(item, index){
                            if (node.lastId == null  || node.lastId < item.id){
                                // payload.push(item);
                                if (index === json.length-1){
                                    node.lastId = item.id;
                                }
                                delete item.id;
                                delete item["sensor_id"];
                                delete item["sensor_name"];
                                msg.payload = item;
                                node.send(msg);
                            }
                        });
                        // if(payload.length > 0){
                        //     node.log(JSON.stringify(payload));
                        //     msg.payload = JSON.stringify(payload);
                        //     node.send(msg);
                        // }
                        payload = [];
                    }
                    bodyChunks =[];
                    
                })
            });
    }

    function makeHTTPRequest(url, method, node, msg){
        var opts = urllib.parse(url);
            opts.method = method;
            opts.headers = {};
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
                res.setEncoding('utf8');
                msg.statusCode = res.statusCode;
                msg.headers = res.headers;
                var result = "";
                res.on('data',function(chunk) {
                    result += chunk;
                });
                res.on('end',function() {
                    msg.payload = JSON.stringify(result);
                    node.send(msg);
                    node.status({});

                    if (res.statusCode !=201){
                        node.error ("Node "+node.name + ": "+msg.payload);
                    }
                });
            }).on('error', function(e){
                node.warn ("Got Error: "+e.message);
            });
            // req.on('error',function(err) {
            //     msg.payload = err.toString() + " : " + url;
            //     msg.statusCode = err.code;
            //     node.send(msg);
            //     node.status({fill:"red",shape:"ring",text:err.code});
            // });
            if (payload) {
                req.write(payload);
            }
            req.end();

    }
};
