/**
 * Powwer Meter webserver controller object.
 * 
 */
var config = require('../config-private'),
    events = require('events'),
    logger = require('winston'),
    async  = require('async'),
    meter  = require('power-meter-monitor').meter;


var power = {};
var ctrl  = new events.EventEmitter();

logger.info("Got config: ", config.redis);

// bootstrapping the redis client with the config settings
meter.db = meter.getRedisClient(config.redis);

ctrl.handleGetHour = function (req, res) {
    logger.info("handle get hour:", req.params.type);
    meter.db.lrange("hour", -3600, -1, function (err, values) {
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

        var data = {
            "description": "Watts per second over an hour",
            "version":     "Power Meter API v0.1",
            "container": "Array",
            "items": list 
        }

        var body = JSON.stringify(data) + "\n";

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
};

ctrl.handleCurrentUsage = function (req, res) {
    var interval = parseInt(req.params.interval) || 5;
    meter.db.lrange("hour", (interval*-1), -1, function (err, values) {
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            sum += parseInt(JSON.parse(values[i]).pulseCount);
        }

        var average = (sum/values.length);
        var kWhs    = (average/10000);
        var data = {
            "description": "Current Usage in Watts",
            "version":     "Power Meter API v0.1",
            "sum":         sum,
            "average":     average,
            "interval":    interval,
            "watt":        parseInt(kWhs*3600*1000),
            "kWhs":        kWhs
        };

        var body = JSON.stringify(data) + "\n";
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
};


ctrl.kwh = {};
ctrl.kwh.handler = function (req, res) {
    var type  = req.params.resolution;

    if (type == "today") return ctrl.kwh.today(req, res);

    var count = req.params.count || 1;
    var now   = new Date();

    // I need to spool to the earliest full hour.
    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);
    if (type == "day") now.setHours(0);
    var types = {
        "hour": ["setHours", "getHours"],
        "day":  ["setDate",  "getDate"]    
    };
    async.times(count, function(n, callback) {
        var key = type + ":" + now.toJSON();
        now[types[type][0]](now[types[type][1]]()-1);
        meter.db.get(key, function(err, value) {
            callback(null, JSON.parse(value));    
        });
    }, function (err, values) {
        var result = {
            "description": "kKh consumed by day per hour",
            "version": "Power Meter API v0.1",
            "items": values.reverse()
        };

        var body = JSON.stringify(result) + "\n";

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);

    });

};


ctrl.kwh.today = function (req, res) {
    var range = 24*60;
    var now   = new Date();
    
    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);
    now.setHours(0);

    meter.db.lrange("day", (range*-1), -1, function (err, values) {
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            var item = JSON.parse(values[i]);
            if (item.timestamp < now.getTime()) continue;
            
            sum += item.total;
        }

        var result = {
            "description": "kWh consumed today",
            "version": "Power Meter API v0.1",
            "date": now.toJSON(),
            "kwh": (sum/10000)
        } 

        var body = JSON.stringify(result) + "\n";

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
};

ctrl.meter = {};
ctrl.meter.total = {};
ctrl.meter.total.put = function (req, res) {
    var data = {
        "timestamp": (new Date()).toJSON(),
        "value": req.body.value
    }
    meter.db.set("meterTotal", JSON.stringify(data), function (err, reply) {
        logger.info("Got reply: ", reply);
        logger.info("error object: ", err);
    });

    meter.db.set("meterTotalDelta", 0.0, function (err, reply) {
        logger.info("meterTotalDelta reply: ", reply, err);
    });

    data.description = "put power meter value on server";
    data.delta = 0.0;

    var body = JSON.stringify(data) + "\n";
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', body.length);
    res.end(body);
};

ctrl.meter.total.get = function (req, res) {
    meter.db.get("meterTotal", function (err, reply) {
        logger.info("getting meterTotal reply: ", reply);
        var data = JSON.parse(reply);

        // Hm.. I really need promises here.
        meter.db.get("meterTotalDelta", function (err, reply) {
            data.description = "Current Power meter total registered on server";
            data.delta = reply;
            var body = JSON.stringify(data) + "\n";

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', body.length);
            res.end(body);
        });
    });
};

ctrl.calculateStartTime = function () {
    var aDayAgo = new Date((new Date()).getTime() - (25*60*60*1000));
    var millis  = aDayAgo.getMilliseconds();
    var seconds = aDayAgo.getSeconds();
    var minutes = aDayAgo.getMinutes();
    var hours   = aDayAgo.getHours();

    var diff = (60-seconds)*1000;
    diff += (59-minutes)*60*1000;
    diff -= millis;

    var time = aDayAgo.getTime() + diff;
    var test = new Date(time);

    return time;  
}

power.controller = ctrl;
power.meter      = meter;

module.exports = power;

