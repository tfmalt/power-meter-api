/*
 * Power meter app. An express frontend to reading a power meter with a
 * flashing led using a photo resistive sensor on an Arduino Uno board.
 *
 * This is most of all a toy experiment to get me up to speed on some of
 * the latest web technologies.
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2014 Thomas Malt <thomas@malt.no>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/**
 * Power Meter webserver controller object.
 * 
 * Copyright 2013-2014 Thomas Malt <thomas@malt.no>
 */
var config = require('../config').redis,
    Q      = require('q'),
    events = require('events'),
    logger = require('winston'),
    redis  = require('then-redis');

logger.info("Power got config: ", JSON.stringify(config));

var power = {};
var ctrl  = new events.EventEmitter();

ctrl.version = "0.3.8";
ctrl.read    = redis.createClient(config.read);
ctrl.write   = redis.createClient(config.write);

ctrl.read.connect().then(function () {
    "use strict";
    logger.info("Connected to redis read: ", config.read);
}, function (err) {
    "use strict";
    logger.error("Failed connecting to redis read: " + err, config.read);
});
ctrl.write.connect().then(function () {
    "use strict";
    logger.info("Connected to redis write: ", config.write);
}, function (err) {
    "use strict";
    logger.error("Failed connecting to redis write: " + err, config.write);
});

// bootstrapping the redis client with the config settings

ctrl.watts = {};
ctrl.watts.hour = {};
ctrl.watts.hour.get = function (type) {
    "use strict";
    logger.info("handle usage hour get:", type);

    return Q(ctrl.read.lrange("hour", -3600, -1).then(function (values) {
        logger.info("in then after lrange");

        var list = [];
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            var item = JSON.parse(values[i]);
            var pulsecount = parseInt(item.pulseCount);
            var average = 0;
            if ((i+1)%10) {
                sum += pulsecount;
                continue;
            }
            
            average = sum/10;
            var timestamp  = new Date(item.timestamp);

            var kwhs = (average/10000);
            var watt = parseInt(kwhs*3600*1000);
            var label = timestamp.toLocaleTimeString().replace(/:\d\d$/, "");

            list.push([label, watt]);
            sum = 0;
        }

        return list
    }).then( function (list) { 
        logger.info("in construct result body");
        var data = {
            "description": "Watts per second over an hour",
            "version": ctrl.version,
            "container": "Array",
            "items": list
        };

        return JSON.stringify(data) + "\n";
    }));
};


ctrl.watts.get = function (interval) {
    logger.info("handle usage: ", interval);
    return Q(ctrl.read.lrange("hour", (interval*-1), -1)).then(function (values) {
        var sum = 0;
        logger.info("Got here: ", interval);
        for (var i = 0; i < values.length; i++) {
            sum += parseInt(JSON.parse(values[i]).pulseCount);
        }

        var average = (sum/values.length);
        var kWhs    = (average/10000);
        var data = {
            "description": "Current Usage in Watts",
            "version": ctrl.version,
            "sum":         sum,
            "average":     average,
            "interval":    interval,
            "watt":        parseInt(kWhs*3600*1000),
            "kWhs":        kWhs
        };

        return JSON.stringify(data) + "\n";
    }, ctrl.handleRedisError);
};

ctrl.handleRedisError = function (error) {
    logger.error("On rejected, Something else: ", error);   
};

ctrl.kwh = {};
/**
 * Handler for fetching the kwh consumption for various intervals
 */
ctrl.kwh.handler = function (type, count) {
    logger.info("kwh handler: " + type + ", count: " + count);

    if (type == "today") return ctrl.kwh.today();

    var now = new Date();
    
    logger.info("kwh handler: Initial date before run: " + now.toJSON());

    // I need to spool to the earliest full hour.
    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);

    if (type == "day") now.setHours(0);
    var types = {
        "hour": ["setHours", "getHours"],
        "day":  ["setDate",  "getDate"]    
    };

    logger.info("kwh handler: Date after aligning: " + now.toJSON());

    var promises = []; 
    for (var i = 0; i < count; i++) {
        var key = type + ":" + now.toJSON();
        now[types[type][0]](now[types[type][1]]()-1);
        promises.push(ctrl.read.get(key));

        logger.info("kwh handler: pushed promised key: " + key);
    }

    return Q.all(promises).then(function (values) {
        var items = values.map(function (val) { return JSON.parse(val); }).reverse();
        logger.info("kwh handler: promised values", JSON.stringify(items));
        var desc = "kKh consumed per " + type + " for " + count + " " + type + "s";
        var result = {
            "description": desc,
            "version": ctrl.version,
            "items": items
        };

        return JSON.stringify(result) + "\n";
    });
};


ctrl.kwh.today = function () {
    var range = 24*60;
    var now   = new Date();
    
    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);
    now.setHours(0);

    return Q(ctrl.read.lrange("day", (range*-1), -1).then( function (values) {
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            var item = JSON.parse(values[i]);
            if (item.timestamp < now.getTime()) continue;
            
            sum += item.total;
        }

        var result = {
            "description": "kWh used today from midnight to now.",
            "version": ctrl.version,
            "date": now.toJSON(),
            "kwh": (sum/10000)
        };

        return JSON.stringify(result) + "\n";
    }));
};


ctrl.meter = {};
ctrl.meter.total = {};
ctrl.meter.total.put = function (value) {
    var data = {
        "timestamp": (new Date()).toJSON(),
        "value": value
    };
    logger.info("ctrl.meter.total.put: ", JSON.stringify(data));

    return Q.all([
        ctrl.write.set("meterTotal", JSON.stringify(data)),
        ctrl.write.set("meterTotalDelta", 0.0)
    ]).then(function (replies) {
        logger.info("meterTotaland delta replies: ", replies);
        data.version     = ctrl.version;
        data.description = "Put power meter value on server";
        data.delta       = 0.0;
        return JSON.stringify(data) + "\n";
    });
};

ctrl.meter.total.get = function () {
    return Q.all([
        ctrl.read.get("meterTotal"),
        ctrl.read.get("meterTotalDelta")
    ]).then( function (replies) {
        var data = JSON.parse(replies[0]);

        data.description = "Current Power meter total registered on server";
        data.version = ctrl.version;
        data.delta = replies[1];
    
        return JSON.stringify(data) + "\n";
    });
};


ctrl.calculateStartTime = function () {
    var aDayAgo = new Date((new Date()).getTime() - (25*60*60*1000));
    var millis  = aDayAgo.getMilliseconds();
    var seconds = aDayAgo.getSeconds();
    var minutes = aDayAgo.getMinutes();
    // var hours   = aDayAgo.getHours();

    var diff = (60-seconds)*1000;
    diff += (59-minutes)*60*1000;
    diff -= millis;

    return aDayAgo.getTime() + diff;
    // var test = new Date(time);
    // return time;
};

power.controller = ctrl;

module.exports = power;

