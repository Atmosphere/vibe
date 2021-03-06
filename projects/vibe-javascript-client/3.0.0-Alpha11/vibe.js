/*
 * Vibe v3.0.0-Alpha11
 * http://vibe-project.github.io/projects/vibe-javascript-client/
 * 
 * Copyright 2014 The Vibe Project 
 * Licensed under the Apache License, Version 2.0
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Implement the Universal Module Definition (UMD) pattern 
// see https://github.com/umdjs/umd/blob/master/returnExports.js
(function(root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD
        define([], function() {
            return factory(root);
        });
    } else if (typeof exports === "object") {
        // Node
        // Prepare the window object
        var window = require("jsdom").jsdom().parentWindow;
        window.WebSocket = require("ws");
        window.EventSource = require("eventsource");
        module.exports = factory(window);
        // node-XMLHttpRequest 1.x conforms XMLHttpRequest Level 1 but can perform a cross-domain request
        module.exports.util.corsable = true;
    } else {
        // Browser globals, Window
        root.vibe = factory(root);
    }
}(this, function(window) {
    // Enables ECMAScript 5's strict mode
    "use strict";
    
    // A global identifier
    var guid = 1;
    // Prototype shortcuts
    var slice = Array.prototype.slice;
    var toString = Object.prototype.toString;
    var hasOwn = Object.prototype.hasOwnProperty;
    // Variables for Node
    var document = window.document;
    var location = window.location;
    var navigator = window.navigator;
    // Shortcut to find head tag
    var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;

    // Most are inspired by jQuery
    var util = {};
    util.isArray = Array.isArray || function(array) {
        return toString.call(array) === "[object Array]";
    };
    util.makeAbsolute = function(url) {
        var div = document.createElement("div");
        // Uses an innerHTML property to obtain an absolute URL
        div.innerHTML = '<a href="' + url + '"/>';
        // encodeURI and decodeURI are needed to normalize URL between Internet Explorer and non-Internet Explorer,
        // since Internet Explorer doesn't encode the href property value and return it - http://jsfiddle.net/Yq9M8/1/
        return encodeURI(decodeURI(div.firstChild.href));
    };
    util.on = function(elem, type, fn) {
        if (elem.addEventListener) {
            elem.addEventListener(type, fn, false);
        } else if (elem.attachEvent) {
            elem.attachEvent("on" + type, fn);
        }
    };
    util.stringifyURI = function(url, params) {
        var name;
        var s = [];
        params = params || {};
        params._ = guid++;
        // params is supposed to be one-depth object
        for (name in params) {
            // null or undefined param value should be excluded 
            if (params[name] != null) {
                s.push(encodeURIComponent(name) + "=" + encodeURIComponent(params[name]));
            }
        }
        return url + (/\?/.test(url) ? "&" : "?") + s.join("&").replace(/%20/g, "+");
    };
    util.parseURI = function(url) {
        // Deal with only query part
        var obj = {query: {}};
        var match = /.*\?([^#]*)/.exec(url);
        if (match) {
            var array = match[1].split("&");
            for (var i = 0; i < array.length; i++) {
                var part = array[i].split("=");
                obj.query[decodeURIComponent(part[0])] = decodeURIComponent(part[1] || "");
            }
        }
        return obj;
    };
    util.createXMLHttpRequest = function() {
        try {
            return new window.XMLHttpRequest();
        } catch (e1) {
            try {
                return new window.ActiveXObject("Microsoft.XMLHTTP");
            } catch (e2) {}
        }
    };
    util.parseJSON = window.JSON ? window.JSON.parse : function(data) {
        return Function("return " + data)();
    };
    // http://github.com/flowersinthesand/stringifyJSON
    util.stringifyJSON = window.JSON ? window.JSON.stringify : function(value) {
        var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
            meta = {
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };
        
        function quote(string) {
            return '"' + string.replace(escapable, function(a) {
                var c = meta[a];
                return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"';
        }
        
        function f(n) {
            return n < 10 ? "0" + n : n;
        }
        
        return (function str(key, holder) {
            var i, v, len, partial, value = holder[key], type = typeof value;
                    
            if (value && typeof value === "object" && typeof value.toJSON === "function") {
                value = value.toJSON(key);
                type = typeof value;
            }
            
            switch (type) {
            case "string":
                return quote(value);
            case "number":
                return isFinite(value) ? String(value) : "null";
            case "boolean":
                return String(value);
            case "object":
                if (!value) {
                    return "null";
                }
                
                switch (toString.call(value)) {
                case "[object Date]":
                    return isFinite(value.valueOf()) ?
                        '"' + value.getUTCFullYear() + "-" + f(value.getUTCMonth() + 1) + "-" + f(value.getUTCDate()) +
                        "T" + f(value.getUTCHours()) + ":" + f(value.getUTCMinutes()) + ":" + f(value.getUTCSeconds()) + "Z" + '"' :
                        "null";
                case "[object Array]":
                    len = value.length;
                    partial = [];
                    for (i = 0; i < len; i++) {
                        partial.push(str(i, value) || "null");
                    }
                    
                    return "[" + partial.join(",") + "]";
                default:
                    partial = [];
                    for (i in value) {
                        if (hasOwn.call(value, i)) {
                            v = str(i, value);
                            if (v) {
                                partial.push(quote(i) + ":" + v);
                            }
                        }
                    }
                    
                    return "{" + partial.join(",") + "}";
                }
            }
        })("", {"": value});
    };
    // CORS able
    util.corsable = "withCredentials" in util.createXMLHttpRequest();
    // Browser sniffing
    util.browser = (function() {
        var ua = navigator.userAgent.toLowerCase();
        var browser = {};
        var match =
            // IE 6-10
            /(msie) ([\w.]+)/.exec(ua) ||
            // IE 11+
            /(trident)(?:.*? rv:([\w.]+)|)/.exec(ua) ||
            // Safari
            ua.indexOf("android") < 0 && /version\/(.+) (safari)/.exec(ua) || [];

        // Swaps variables
        if (match[2] === "safari") {
            match[2] = match[1];
            match[1] = "safari";
        }
        browser[match[1] || ""] = true;
        browser.version = match[2] || "0";
        browser.vmajor = browser.version.split(".")[0];
        // Trident is the layout engine of the Internet Explorer
        if (browser.trident) {
            browser.msie = true;
        }
        return browser;
    })();
    util.crossOrigin = function(uri) {
        // Origin parts
        var parts = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/.exec(uri.toLowerCase());
        return !!(parts && (
            // protocol
            parts[1] != location.protocol ||
            // hostname
            parts[2] != location.hostname ||
            // port
            (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (location.port || (location.protocol === "http:" ? 80 : 443))
        ));
    };
    
    // Inspired by jQuery.Callbacks
    function createCallbacks(deferred) {
        var locked;
        var memory;
        var firing;
        var firingStart;
        var firingLength;
        var firingIndex;
        var list = [];
        var fire = function(context, args) {
            args = args || [];
            memory = !deferred || [context, args];
            firing = true;
            firingIndex = firingStart || 0;
            firingStart = 0;
            firingLength = list.length;
            for (; firingIndex < firingLength && !locked; firingIndex++) {
                list[firingIndex].apply(context, args);
            }
            firing = false;
        };
        var self = {
            add: function(fn) {
                var length = list.length;
                
                list.push(fn);
                if (firing) {
                    firingLength = list.length;
                } else if (!locked && memory && memory !== true) {
                    firingStart = length;
                    fire(memory[0], memory[1]);
                }
            },
            remove: function(fn) {
                var i;
                
                for (i = 0; i < list.length; i++) {
                    if (fn === list[i] || (fn.guid && fn.guid === list[i].guid)) {
                        if (firing) {
                            if (i <= firingLength) {
                                firingLength--;
                                if (i <= firingIndex) {
                                    firingIndex--;
                                }
                            }
                        }
                        list.splice(i--, 1);
                    }
                }
            },
            fire: function(context, args) {
                if (!locked && !firing && !(deferred && memory)) {
                    fire(context, args);
                }
            },
            lock: function() {
                locked = true;
            },
            locked: function() {
                return !!locked;
            },
            unlock: function() {
                locked = memory = firing = firingStart = firingLength = firingIndex = undefined;
            }
        };
        
        return self;
    }
    
    // Socket object
    function createSocket(uris, options) {
        // Default socket options
        var defaults = {
            reconnect: function(lastDelay) {
                return 2 * (lastDelay || 250);
            },
            transports: [createWebSocketTransport, createHttpStreamTransport, createHttpLongpollTransport]
        };
        // Overrides defaults
        if (options) {
            for (var i in options) {
                defaults[i] = options[i];
            }
        }
        options = defaults;

        // Socket
        var self = {};
        // Events
        var events = {};
        // Adds event handler
        self.on = function(type, fn) {
            var event;
            // For custom event
            event = events[type];
            if (!event) {
                if (events.message.locked()) {
                    return this;
                }
                event = events[type] = createCallbacks();
                event.order = events.message.order;
            }
            event.add(fn);
            return this;
        };
        // Removes event handler
        self.off = function(type, fn) {
            var event = events[type];
            if (event) {
                event.remove(fn);
            }
            return this;
        };
        // Adds one time event handler
        self.once = function(type, fn) {
            function proxy() {
                self.off(type, proxy);
                fn.apply(self, arguments);
            }
            fn.guid = fn.guid || guid++;
            proxy.guid = fn.guid;
            return self.on(type, proxy);
        };
        // Fires event handlers
        self.fire = function(type) {
            var event = events[type];
            if (event) {
                event.fire(self, slice.call(arguments, 1));
            }
            return this;
        };

        // Networking
        // Transport associated with this socket
        var transport;
        // Reconnection
        var reconnectTimer;
        var reconnectDelay;
        var reconnectTry;
        // For internal use only
        // Establishes a connection
        self.open = function() {
            // From null or waiting state
            state = "preparing";
            // Resets the transport
            transport = null;
            // Cancels the scheduled connection
            clearTimeout(reconnectTimer);
            // Increases the number of reconnection attempts
            if (reconnectTry) {
                reconnectTry++;
            }
            // Resets event helpers
            for (var type in events) {
                events[type].unlock();
            }
            // Fires the connecting event and connects to the server
            return self.fire("connecting");
        };
        // Disconnects the connection
        self.close = function() {
            // Prevents reconnection
            options.reconnect = false;
            clearTimeout(reconnectTimer);
            if (transport) {
                // It finally fires close event to socket
                transport.close();
            } else {
                // If this method is called while connecting to the server
                self.fire("close");
            }
            return this;
        };
        // State
        var state;
        self.state = function() {
            return state;
        };
        // Each event represents a possible state of this socket
        // they are considered as special event and works in a different way
        for (var i in {connecting: 1, open: 1, close: 1, waiting: 1}) {
            // This event fires only one time and handlers being added after fire are fired immediately
            events[i] = createCallbacks(true);
            // State transition order
            events[i].order = guid++;
        }
        // However all the other event including message event work as you expected
        // it fires many times and handlers are executed whenever it fires
        events.message = createCallbacks(false);
        // It shares the same order with the open event because it can be fired when a socket is in the opened state
        events.message.order = events.open.order;
        // State transition
        self.on("connecting", function() {
            // From preparing state
            state = "connecting";
            // Final URIs to work with transport
            var candidates = util.isArray(uris) ? slice.call(uris) : [uris];
            for (var i = 0; i < candidates.length; i++) {
                var uri = candidates[i] = util.makeAbsolute(candidates[i]);
                if (/^https?:/.test(uri) && !util.parseURI(uri).query.transport) {
                    candidates.splice(i, 1,
                        uri.replace(/^http/, "ws"), 
                        // Usually util.stringifyURI is not used when query is constant
                        // it's used here for convenience since we need to know if uri has already query
                        util.stringifyURI(uri, {transport: "stream"}), 
                        util.stringifyURI(uri, {transport: "longpoll"}));
                }
            }
            // Starts a process to find a working transport
            (function open() {
                var uri = candidates.shift();
                // If every available transport failed
                if (!uri) {
                    self.fire("error", new Error()).fire("close");
                    return;
                }
                // Deremines a transport from URI through transports option
                var trans;
                for (var i = 0; i < options.transports.length; i++) {
                    trans = options.transports[i](uri, options);
                    if (trans) {
                        break;
                    }
                }
                // It would be null if it can't run on this environment
                if (!trans) {
                    open();
                    return;
                }
                // This is to stop the whole process to find a working transport 
                // when socket's close method is called while doing that
                function stop() {
                    trans.off("close", open).close();
                }
                self.once("close", stop);
                trans.open().on("close", open).on("text", function handshaker(data) {
                    // handshaker is one-time event handler
                    trans.off("text", handshaker);
                    var query = util.parseURI(data).query;
                    // An heartbeat option can't be set by user
                    options.heartbeat = +query.heartbeat;
                    // To speed up heartbeat test
                    options._heartbeat = +query._heartbeat || 5000;
                    // Now that handshaking is completed, associates the transport with the socket
                    transport = trans.off("close", open);
                    var skip;
                    transport.on("text", function(data) {
                        // Because this handler is executed on dispatching text event, 
                        // first message for handshaking should be skipped
                        if (!skip) {
                            skip = true;
                            return;
                        }
                        // Inbound event
                        var event = util.parseJSON(data); 
                        var latch;
                        var reply = function(success) {
                            return function(value) {
                                // The latch prevents double reply.
                                if (!latch) {
                                    latch = true;
                                    self.send("reply", {id: event.id, data: value, exception: !success});
                                }
                            };
                        };
                        var args = [event.type, event.data, !event.reply ? null : {resolve: reply(true), reject: reply(false)}];
                        self.fire.apply(self, args);
                    })
                    .on("error", function(error) {
                        self.fire("error", error);
                    })
                    .on("close", function() {
                        self.fire("close");
                    });
                    // And fires open event to socket
                    self.off("close", stop).fire("open");
                });
            })();
        })
        .on("open", function() {
            // From connecting state
            state = "opened";
            var heartbeatTimer;
            // Sets a heartbeat timer and clears it on close event
            (function setHeartbeatTimer() {
                // heartbeat event will be sent after options.heartbeat - options._heartbeat ms
                heartbeatTimer = setTimeout(function() {
                    self.send("heartbeat").once("heartbeat", function() {
                        clearTimeout(heartbeatTimer);
                        setHeartbeatTimer();
                    });
                    // transport will be closed after options._heartbeat ms
                    // unless the server responds it
                    heartbeatTimer = setTimeout(function() {
                        self.fire("error", new Error("heartbeat"));
                        transport.close();
                    }, options._heartbeat);
                }, options.heartbeat - options._heartbeat);
            })();
            self.once("close", function() {
                clearTimeout(heartbeatTimer);
            });
            // Locks the connecting event
            events.connecting.lock();
            // Initializes variables related with reconnection
            reconnectTimer = reconnectDelay = reconnectTry = null;
        })
        .on("close", function() {
            // From preparing, connecting or opened state
            state = "closed";
            // Locks event whose order is lower than close event
            for (var type in events) {
                var event = events[type];
                if (event.order < events.close.order) {
                    event.lock();
                }
            }
            // Schedules reconnection
            if (options.reconnect) {
                // By adding a handler by one method in event handling
                // it will be the last one of close event handlers having been added 
                self.once("close", function() {
                    reconnectTry = reconnectTry || 1;
                    reconnectDelay = options.reconnect.call(self, reconnectDelay, reconnectTry);
                    if (reconnectDelay !== false) {
                        reconnectTimer = setTimeout(function() {
                            self.open();
                        }, reconnectDelay);
                        self.fire("waiting", reconnectDelay, reconnectTry);
                    }
                });
            }
        })
        .on("waiting", function() {
            // From closed state
            state = "waiting";
        });
        
        // Messaging
        // A map for reply callback
        var callbacks = {};
        // Sends an event to the server via the connection
        self.send = function(type, data, onResolved, onRejected) {
            if (state !== "opened") {
                self.fire(new Error("notopened"));
                return this;
            }
            
            // Outbound event
            var event = {id: guid++, type: type, data: data, reply: !!(onResolved || onRejected)};
            if (event.reply) {
                callbacks[event.id] = [onResolved, onRejected];
            }
            // Delegates to the transport
            transport.send(util.stringifyJSON(event));
            return this;
        };
        self.on("reply", function(reply) {
            // callbacks[reply.id] is [onResolved, onRejected]
            // FYI +false and +true is 0 and 1, respectively
            callbacks[reply.id][+reply.exception].call(self, reply.data);
            delete callbacks[reply.id];
        });
        return self.open();
    }

    function createBaseTransport(uri, options) {
        var timeout = options && options.timeout || 3000;
        var self = {};
        self.open = function() {
            // Establishes a real connection
            self.connect();
            // Sets a timeout timer and clear it on open or close event
            var timeoutTimer = setTimeout(function() {
                self.fire("error", new Error("timeout")).close();
            }, timeout);
            function clearTimeoutTimer() {
                clearTimeout(timeoutTimer);
            }
            self.on("open", clearTimeoutTimer).on("close", clearTimeoutTimer);
            return this;
        };
        // Transport events
        var events = {open: createCallbacks(true), text: createCallbacks(), binary: createCallbacks(), error: createCallbacks(), close: createCallbacks(true)};
        self.on = function(type, fn) {
            events[type].add(fn);
            return this;
        };
        self.off = function(type, fn) {
            events[type].remove(fn);
            return this;
        };
        self.fire = function(type) {
            events[type].fire(self, slice.call(arguments, 1));
            return this;
        };
        return self;
    }

    function createWebSocketTransport(uri, options) {
        var WebSocket = window.WebSocket;
        if (!WebSocket || !/^wss?:/.test(uri)) {
            return;
        }
        var ws;
        var self = createBaseTransport(uri, options);
        self.connect = function() {
            ws = new WebSocket(uri);
            ws.binaryType = "arraybuffer";
            ws.onopen = function() {
                self.fire("open");
            };
            ws.onmessage = function(event) {
                if (typeof event.data === "string") {
                    self.fire("text", event.data);
                } else {
                    // event.data is ArrayBuffer in browser and Buffer in Node
                    self.fire("binary", event.data);
                }
            };
            ws.onerror = function() {
                self.fire("error", new Error()).fire("close");
            };
            ws.onclose = function() {
                self.fire("close");
            };
        };
        self.send = function(data) {
            ws.send(data);
            return this;
        };
        self.close = function() {
            ws.close();
            return this;
        };
        return self;
    }

    function createHttpBaseTransport(uri, options) {
        var xdrURL = options && options.xdrURL;
        var self = createBaseTransport(uri, options);
        // Because id is set on open event
        var sendURI;
        self.on("open", function() {
            sendURI = util.stringifyURI(uri, {id: self.id});
        })
        .on("close", function() {
            sendURI = null;
        });
        // Try again as long as the transport is opened
        function retry(data) {
            if (sendURI) {
                self.send(data);
            }
        }
        self.send = !util.crossOrigin(uri) || util.corsable ?
        // By XMLHttpRequest
        function(data) {
            var xhr = util.createXMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && xhr.status !== 200) {
                    retry(data);
                }
            };
            xhr.open("POST", sendURI);
            xhr.setRequestHeader("content-type", "text/plain; charset=UTF-8");
            if (util.corsable) {
                xhr.withCredentials = true;
            }
            xhr.send("data=" + data);
            return this;
        } : window.XDomainRequest && xdrURL ?
        // By XDomainRequest
        function(data) {
            // Only text/plain is supported for the request's Content-Type header
            // from the fourth at http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
            var xdr = new window.XDomainRequest();
            xdr.onerror = function() {
                retry(data);
            };
            xdr.open("POST", xdrURL.call(self, sendURI));
            xdr.send("data=" + data);
            return this;
        } :
        // By HTMLFormElement
        function(data) {
            var iframe;
            var textarea;
            var form = document.createElement("form");
            form.action = sendURI;
            form.target = "socket-" + (guid++);
            form.method = "POST";
            // Internet Explorer 6 needs encoding property
            form.enctype = form.encoding = "text/plain";
            form.acceptCharset = "UTF-8";
            form.style.display = "none";
            form.innerHTML = '<textarea name="data"></textarea><iframe name="' + form.target + '"></iframe>';
            textarea = form.firstChild;
            textarea.value = data;
            iframe = form.lastChild;
            util.on(iframe, "error", function() {
                retry(data);
            });
            util.on(iframe, "load", function() {
                document.body.removeChild(form);
            });
            document.body.appendChild(form);
            form.submit();
            return this;
        };
        // To notify server only once
        var latch;
        self.close = function() {
            // Aborts the real connection
            self.abort();
            if (!latch) {
                latch = true;
                // Sends the abort request to the server
                // this request is supposed to work even in unloading event so script tag should be used
                var script = document.createElement("script");
                script.async = false;
                script.src = util.stringifyURI(uri, {id: self.id, when: "abort"});
                script.onload = script.onerror = script.onreadystatechange = function() {
                    if (!script.readyState || /loaded|complete/.test(script.readyState)) {
                        script.onload = script.onreadystatechange = null;
                        if (script.parentNode) {
                            script.parentNode.removeChild(script);
                        }
                        // Fires the close event but it may be already fired by transport
                        self.fire("close");
                    }
                };
                head.insertBefore(script, head.firstChild);
            }
            return this;
        };
        return self;
    }

    function createHttpStreamTransport(uri, options) {
        if (/^https?:/.test(uri) && util.parseURI(uri).query.transport === "stream") {
            return createHttpSseTransport(uri, options) || createHttpStreamXhrTransport(uri, options) || createHttpStreamXdrTransport(uri, options) || createHttpStreamIframeTransport(uri, options);
        }
    }

    function createHttpSseTransport(uri, options) {
        var EventSource = window.EventSource;
        if (!EventSource || (util.crossOrigin(uri) && util.browser.safari && util.browser.vmajor < 7)) {
            return;
        }
        var es;
        var self = createHttpBaseTransport(uri, options);
        self.connect = function() {
            es = new EventSource(uri + "&when=open&sse=true", {withCredentials: true});
            var handshaked;
            es.onmessage = function(event) {
                // The first message is handshake result
                if (!handshaked) {
                    handshaked = true;
                    var query = util.parseURI(event.data).query;
                    // Assign a newly issued identifier for this transport
                    self.id = query.id;
                    self.fire("open");
                } else {
                    self.fire("text", event.data);
                }
            };
            es.onerror = function() {
                es.close();
                // There is no way to find whether there was an error or not
                self.fire("close");
            };
        };
        self.abort = function() {
            es.close();
        };
        return self;
    }

    function createHttpStreamBaseTransport(uri, options) {
        var buffer = "";
        var self = createHttpBaseTransport(uri, options);
        var handshaked;
        // The detail about parsing is explained in the reference implementation
        self.parse = function(chunk) {
            // Strips off the left padding of the chunk that appears in the
            // first chunk
            chunk = chunk.replace(/^\s+/, "");
            // The chunk should be not empty for correct parsing, 
            if (chunk) {
                // String.prototype.split with string separator is reliable cross-browser
                var lines = (buffer + chunk).split("\n\n");
                for (var i = 0; i < lines.length - 1; i++) {
                    var data = lines[i].substring("data: ".length);
                    if (!handshaked) {
                        handshaked = true;
                        var query = util.parseURI(data).query;
                        // Assign a newly issued identifier for this transport
                        self.id = query.id;
                        self.fire("open");
                    } else {
                        self.fire("text", data);
                    }
                }
                buffer = lines[lines.length - 1];
            }
        };
        return self;
    }

    function createHttpStreamXhrTransport(uri, options) {
        if ((util.browser.msie && util.browser.vmajor < 10) || (util.crossOrigin(uri) && !util.corsable)) {
            return;
        }
        var xhr;
        var self = createHttpStreamBaseTransport(uri, options);
        self.connect = function() {
            var index;
            xhr = util.createXMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 3 && xhr.status === 200) {
                    self.parse(!index ? xhr.responseText : xhr.responseText.substring(index));
                    index = xhr.responseText.length;
                } else if (xhr.readyState === 4) {
                    if (xhr.status !== 200) {
                        self.fire("error", new Error());
                    }
                    self.fire("close");
                }
            };
            xhr.open("GET", uri + "&when=open");
            if (util.corsable) {
                xhr.withCredentials = true;
            }
            xhr.send();
        };
        self.abort = function() {
            xhr.abort();
        };
        return self;
    }

    function createHttpStreamXdrTransport(uri, options) {
        var xdrURL = options && options.xdrURL;
        var XDomainRequest = window.XDomainRequest;
        if (!xdrURL || !XDomainRequest) {
            return;
        }
        var xdr;
        var self = createHttpStreamBaseTransport(uri, options);
        self.connect = function() {
            var index;
            xdr = new XDomainRequest();
            xdr.onprogress = function() {
                self.parse(!index ? xdr.responseText : xdr.responseText.substring(index));
                index = xdr.responseText.length;
            };
            xdr.onerror = function() {
                self.fire("error", new Error()).fire("close");
            };
            xdr.onload = function() {
                self.fire("close");
            };
            xdr.open("GET", xdrURL.call(self, uri + "&when=open"));
            xdr.send();
        };
        self.abort = function() {
            xdr.abort();
        };
        return self;
    }

    function createHttpStreamIframeTransport(uri, options) {
        var ActiveXObject = window.ActiveXObject;
        if (!ActiveXObject || util.crossOrigin(uri)) {
            return;
        }
        var doc;
        var stop;
        var self = createHttpStreamBaseTransport(uri, options);
        self.connect = function() {
            function iterate(fn) {
                var timeoutId;
                // Though the interval is 1ms for real-time application, there is a delay between setTimeout calls
                // For detail, see https://developer.mozilla.org/en/window.setTimeout#Minimum_delay_and_timeout_nesting
                (function loop() {
                    timeoutId = setTimeout(function() {
                        if (fn() === false) {
                            return;
                        }
                        loop();
                    }, 1);
                })();
                return function() {
                    clearTimeout(timeoutId);
                };
            }
            doc = new ActiveXObject("htmlfile");
            doc.open();
            doc.close();
            var iframe = doc.createElement("iframe");
            iframe.src = uri + "&when=open";
            doc.body.appendChild(iframe);
            var cdoc = iframe.contentDocument || iframe.contentWindow.document;
            stop = iterate(function() {
                // Waits the server's container ignorantly
                if (!cdoc.firstChild) {
                    return;
                }
                // Response container
                var container = cdoc.body.lastChild;
                // Detects connection failure
                if (!container) {
                    self.fire("error", new Error()).fire("close");
                    return false;
                }
                function readDirty() {
                    var clone = container.cloneNode(true);
                    // Adds a character not CR and LF to circumvent an Internet Explorer bug
                    // If the contents of an element ends with one or more CR or LF, Internet Explorer ignores them in the innerText property
                    clone.appendChild(cdoc.createTextNode("."));
                    // But the above idea causes \n chars to be replaced with \r\n or for some reason
                    // Restores them to its original state
                    var text = clone.innerText.replace(/\r\n/g, "\n");
                    return text.substring(0, text.length - 1);
                }
                self.parse(readDirty());
                // The container is resetable so no index or length variable is needed
                container.innerText = "";
                stop = iterate(function() {
                    var text = readDirty();
                    if (text) {
                        container.innerText = "";
                        self.parse(text);
                    }
                    if (cdoc.readyState === "complete") {
                        self.fire("close");
                        return false;
                    }
                });
                return false;
            });
        };
        self.abort = function() {
            stop();
            doc.execCommand("Stop");
        };
        return self;
    }

    function createHttpLongpollTransport(uri, options) {
        if (/^https?:/.test(uri) && util.parseURI(uri).query.transport === "longpoll") {
            return createHttpLongpollAjaxTransport(uri, options) || createHttpLongpollXdrTransport(uri, options) || createHttpLongpollJsonpTransport(uri, options);
        }
    }

    function createHttpLongpollBaseTransport(uri, options) {
        var self = createHttpBaseTransport(uri, options);
        self.connect = function() {
            self.poll(uri + "&when=open", function(data) {
                var query = util.parseURI(data).query;
                // Assign a newly issued identifier for this transport
                self.id = query.id;
                (function poll() {
                    self.poll(util.stringifyURI(uri, {id: self.id, when: "poll"}), function(data) {
                        if (data) {
                            poll();
                            self.fire("text", data);
                        } else {
                            self.fire("close");
                        }
                    });
                })();
                self.fire("open");
            });
        };
        return self;
    }

    function createHttpLongpollAjaxTransport(uri, options) {
        if (util.crossOrigin(uri) && !util.corsable) {
            return;
        }
        var xhr;
        var self = createHttpLongpollBaseTransport(uri, options);
        self.poll = function(url, fn) {
            xhr = util.createXMLHttpRequest();
            xhr.onreadystatechange = function() {
                // Avoids c00c023f error on Internet Explorer 9
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        fn(xhr.responseText);
                    } else {
                        self.fire("error", new Error());
                    }
                }
            };
            xhr.open("GET", url);
            if (util.corsable) {
                xhr.withCredentials = true;
            }
            xhr.send(null);
        };
        self.abort = function() {
            xhr.abort();
        };
        return self;
    }

    function createHttpLongpollXdrTransport(uri, options) {
        var xdrURL = options && options.xdrURL;
        var XDomainRequest = window.XDomainRequest;
        if (!xdrURL || !XDomainRequest) {
            return;
        }
        var xdr;
        var self = createHttpLongpollBaseTransport(uri, options);
        self.poll = function(url, fn) {
            url = xdrURL.call(self, url);
            xdr = new XDomainRequest();
            xdr.onload = function() {
                fn(xdr.responseText);
            };
            xdr.onerror = function() {
                self.fire("error", new Error()).fire("close");
            };
            xdr.open("GET", url);
            xdr.send();
        };
        self.abort = function() {
            xdr.abort();
        };
        return self;
    }

    var jsonpCallbacks = [];
    function createHttpLongpollJsonpTransport(uri, options) {
        var script;
        var self = createHttpLongpollBaseTransport(uri, options);
        var callback = jsonpCallbacks.pop() || ("socket_" + (guid++));
        // Attaches callback
        window[callback] = function(data) {
            script.responseText = data;
        };
        self.on("close", function() {
            // Assings an empty function for browsers which are not able to cancel a request made from script tag
            window[callback] = function() {};
            jsonpCallbacks.push(callback);
        });
        self.poll = function(url, fn) {
            script = document.createElement("script");
            script.async = true;
            // In fact, jsonp and callback params are only for first request
            script.src = util.stringifyURI(url, {jsonp: "true", callback: callback});
            script.clean = function() {
                // Assigns null to attributes to avoid memory leak in IE
                script.clean = script.onerror = script.onload = script.onreadystatechange = script.responseText = null;
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            };
            script.onload = script.onreadystatechange = function() {
                if (!script.readyState || /loaded|complete/.test(script.readyState)) {
                    if (script.clean) {
                        script.clean();
                    }
                    fn(script.responseText);
                }
            };
            script.onerror = function() {
                script.clean();
                self.fire("error", new Error()).fire("close");
            };
            head.insertBefore(script, head.firstChild);
        };
        self.abort = function() {
            if (script.clean) {
                script.clean();
            }
        };
        return self;
    }
    
    // Socket instances
    var sockets = [];
    // For browser environment
    util.on(window, "unload", function() {
        var socket;
        for (var i = 0; i < sockets.length; i++) {
            socket = sockets[i];
            // Closes a socket as the document is unloaded
            if (socket.state() !== "closed") {
                socket.close();
            }
        }
    });
    util.on(window, "online", function() {
        var socket;
        for (var i = 0; i < sockets.length; i++) {
            socket = sockets[i];
            // Opens a socket because of no reason to wait
            if (socket.state() === "waiting") {
                socket.open();
            }
        }
    });
    util.on(window, "offline", function() {
        var socket;
        for (var i = 0; i < sockets.length; i++) {
            socket = sockets[i];
            // Fires a close event immediately
            if (socket.state() === "opened") {
                socket.fire("error", new Error()).fire("close");
            }
        }
    });
    
    // Defines the module
    return {
        // Creates a socket and connects to the server
        open: function(uris, options) {
            // Opens a new socket
            var socket = createSocket(uris, options);
            sockets.push(socket);
            return socket;
        },
        // Defines the transport module
        transport: {
            // Creates a WebSocket transport
            createWebSocketTransport: createWebSocketTransport, 
            // Creates a HTTP streaming transport
            createHttpStreamTransport: createHttpStreamTransport, 
            // Creates a HTTP long polling transport
            createHttpLongpollTransport: createHttpLongpollTransport
        },
        // To help debug or apply hotfix only
        util: util
    };
}));