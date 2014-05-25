/**
 * Power Meter webserver controller object.
 * 
 */
var config = require('../config-private').redis,
    Q      = require('q'),
    events = require('events'),
    logger = require('winston'),
    redis  = require('then-redis');
    // meter  = require('power-meter-monitor').meter;

logger.info("Got config: ", config);

var power = {};
var ctrl  = new events.EventEmitter();

ctrl.version = "0.3";
ctrl.db = redis.createClient({
    port: config.port, 
    host: config.host, 
    password: config.auth_pass
});

// bootstrapping the redis client with the config settings

ctrl.watts = {};
ctrl.watts.hour = {};
ctrl.watts.hour.get = function (type) {
    logger.info("handle usage hour get:", type);
    return Q(ctrl.db.lrange("hour", -3600, -1).then(function (values) {
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
        }

        var body = JSON.stringify(data) + "\n";
        return body;
    }));
};


ctrl.watts.get = function (interval) {
    logger.info("handle usage: ", interval);
    return Q(ctrl.db.lrange("hour", (interval*-1), -1).then(function (values) {
        var sum = 0;
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
    }));
};


ctrl.kwh = {};
/**
 * Handler for fetching the kwh consumption for various intervals
 */
ctrl.kwh.handler = function (type, count) {

    if (type == "today") return ctrl.kwh.today();

    var now = new Date();

    // I need to spool to the earliest full hour.
    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);

    if (type == "day") now.setHours(0);
    var types = {
        "hour": ["setHours", "getHours"],
        "day":  ["setDate",  "getDate"]    
    };

    var promises = []; 
    for (var i = 0; i < count; i++) {
        var key = type + ":" + now.toJSON();
        now[types[type][0]](now[types[type][1]]()-1);
        promises.push(ctrl.db.get(key));
    }

    return Q.all(promises).then(function (values) {
        var desc = "kKh consumed per " + type + " for " + count + " " + type + "s";
        var result = {
            "description": desc,
            "version": ctrl.version,
            "items": values.reverse()
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

    return Q(ctrl.db.lrange("day", (range*-1), -1).then( function (values) {
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            var item = JSON.parse(values[i]);
            if (item.timestamp < now.getTime()) continue;
            
            sum += item.total;
        }

        var result = {
            "description": "kWh consumed today",
            "version": ctrl.version,
            "date": now.toJSON(),
            "kwh": (sum/10000)
        } 

        return JSON.stringify(result) + "\n";
    }));
};


ctrl.meter = {};
ctrl.meter.total = {};
ctrl.meter.total.put = function (value) {
    var data = {
        "timestamp": (new Date()).toJSON(),
        "value": value,
        "version": ctrl.version,
        "description": "Put power meter value on server",
        "delta": 0.0
    };

    return Q.all([
        ctrl.db.set("meterTotal", JSON.stringify(data)),
        ctrl.db.set("meterTotalDelta", 0.0)
    ]).then(function (replies) {
        logger.info("meterTotaland delta replies: ", replies);
        return JSON.stringify(data) + "\n";
    });
};

ctrl.meter.total.get = function () {
    return Q.all([
        ctrl.db.get("meterTotal"),
        ctrl.db.get("meterTotalDelta")
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
    var hours   = aDayAgo.getHours();

    var diff = (60-seconds)*1000;
    diff += (59-minutes)*60*1000;
    diff -= millis;

    var time = aDayAgo.getTime() + diff;
    var test = new Date(time);

    return time;  
}

power.controller = ctrl;

module.exports = power;

