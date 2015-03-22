/**
 * Power Meter API controller object.
 *
 * Power meter app. An express frontend to reading a power meter with a
 * flashing led using a photo resistive sensor on an Arduino Uno board.
 *
 * This is most of all a toy experiment to get me up to speed on some of
 * the latest web technologies.
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 */

var config = require('../config').redis,
    Q      = require('q'),
    events = require('events'),
    debug  = require('./debugLog').debug,
    pj     = require('../package.json');

var redis = require('redis');
var power = {};
var ctrl  = new events.EventEmitter();

ctrl.version = pj.version;

debug.log('Running Power Meter API v.' + ctrl.version);
debug.log('Getting ready to connect to redis: ', config.read);

if (process.env.POWER_ENV !== "test") {
    ctrl.read = redis.createClient(config.read.port, config.read.host, config.read.options);
    ctrl.write = redis.createClient(config.write.port, config.read.host, config.read.options);
}

ctrl.watts = {};
ctrl.watts.hour = {};

/**
 * Returns a resolved promise with the list of watts used per second
 * for the last hour.
 *
 * @returns {Promise}
 */
ctrl.watts.hour.get = function () {
    "use strict";

    return Q.ninvoke(ctrl.read, "lrange", "hour", -3600, -1).then(function (values) {
        var list = [];
        var sum = 0;

        for (var i = 0; i < values.length; i++) {
            var item    = JSON.parse(values[i]);

            var count   = parseInt(item.pulseCount);
            var average = 0;

            if (( i + 1 ) % 10) {
                sum += count;
                continue;
            }
            
            average = sum / 10;
            var timestamp  = new Date(item.timestamp);

            var kwhs  = (average/10000);
            var watt  = parseInt(kwhs*3600*1000);
            var label = timestamp.toLocaleTimeString().replace(/:\d\d$/, "");

            list.push([label, watt]);

            sum = 0;
        }
        return list;
    }).then( function (list) {

        return {
            "description": "Watts per second over an hour",
            "version": ctrl.version,
            "container": "Array",
            "items": list
        };
    });
};

/**
 * Returns the current power usage in watts
 *
 * @param interval
 * @returns {Promise}
 */
ctrl.watts.get = function (interval) {
    if (interval === undefined) {
        interval = 1;
    }
    return Q.ninvoke(ctrl.read, "lrange", "hour", (interval * -1), -1).then(function (values) {
        var sum = 0;
        for (var i = 0; i < values.length; i++) {
            sum += parseInt(JSON.parse(values[i]).pulseCount);
        }

        var average = (sum/values.length);
        var kWhs    = (average/10000);
        return {
            "description": "Current Usage in Watts",
            "version": ctrl.version,
            "sum":         sum,
            "average":     average,
            "interval":    interval,
            "watt":        parseInt(kWhs*3600*1000),
            "kWhs":        kWhs
        };

    });
};

/**
 * The kwh part of the api.
 * @type {{}}
 */
ctrl.kwh = {};

/**
 * Handler for fetching the kwh consumption for various intervals.
 * Supports:
 *   kwh/:type/:count
 *   kwh/today
 *   kwh/hour/:count
 *   kwh/day/:count
 *   kwh/week/:count
 *
 * @param type String the type
 * @param count Integer the number of items to fetch.
 * @returns {*}
 */
ctrl.kwh.handler = function (type, count) {
    var keywords = ["today", "hour", "day", "week"];

    if (keywords.indexOf(type) < 0) {
        throw new TypeError(
            "first argument must be a string with one of the keywords: " +
            "'today', 'hour', 'day', 'week'."
        );
    }

    if (type === "today") {
        return ctrl.kwh.today();
    }

    if (count === undefined || count < 1) {
        throw new TypeError(
            "second argument must be an integer with the numbers of items " +
            "to return."
        );
    }

    return ctrl.kwh._getJSONForInterval(type, count);

};

/**
 * Returns the kwh consumption for today
 *
 * @returns {*|exports}
 */
ctrl.kwh.today = function () {
    var range = 24*60;
    var now   = new Date();

    now.setMilliseconds(0);
    now.setSeconds(0);
    now.setMinutes(0);
    now.setHours(0);

    return Q.ninvoke(ctrl.read, "lrange", "day", (range * -1), -1).then(function (values) {
        var sum = 0;

        for (var i = 0; i < values.length; i++) {
            var item = JSON.parse(values[i]);
            if (item.timestamp < now.getTime()) continue;

            sum += item.total;
        }

        return {
            "description": "kWh used today from midnight to now.",
            "version": ctrl.version,
            "date": now.toJSON(),
            "kwh": (sum/10000)
        };
    });
};

/**
 * returns the JSON structure for the given search interval from the redis db.
 *
 * @param type
 * @param count
 * @private
 */
ctrl.kwh._getJSONForInterval = function(type, count) {
    "use strict";
    var promises = ctrl.kwh._getPromises(type, count);
    return Q.all(promises).then(function (values) {
        var items = values.map(function (val) {
            var json = JSON.parse(val);

            if (json.hasOwnProperty("datestr")) {
                json.date = json.datestr;
                delete json.datestr;
            }

            if (json.hasOwnProperty("timestr")) {
                json.date = json.timestr;
                delete json.timestr;
            }

            return json;
        }).reverse();

        var desc  = "kWh consumed per " + type + " for " + count + " " + type + "s";

        return {
            "description": desc,
            "version": ctrl.version,
            "items": items
        };
    });
};

/**
 * Takes input and pushes the right amount of redis get's onto a list of
 * promises for Q.all to invoke.
 *
 * @param type
 * @param count
 * @returns {Array}
 * @private
 */
ctrl.kwh._getPromises = function(type, count) {
    "use strict";

    var now      = ctrl._normalizeDate(new Date(), type);
    var promises = [];

    for (var i = 0; i < count; i++) {
        var key = type + ":" + now.toJSON();
        promises.push(Q.ninvoke(ctrl.read, "get", key));

        switch (type) {
            case 'hour':
                now.setHours(now.getHours()-1);
                break;
            case 'day':
                now.setDate(now.getDate()-1);
                break;
            case 'week':
                now.setDate(now.getDate()-7);
                break;
        }
    }

    return promises;
};


ctrl.meter = {};
ctrl.meter.total = {};
ctrl.meter.total.put = function (value) {
    var data = {
        "timestamp": (new Date()).toJSON(),
        "value": value
    };

    return Q.all([
        ctrl.write.set("meterTotal", JSON.stringify(data)),
        ctrl.write.set("meterTotalDelta", 0.0)
    ]).then(function () {
        data.version     = ctrl.version;
        data.description = "Put power meter value on server";
        data.delta       = 0.0;
        return JSON.stringify(data) + "\n";
    });
};

ctrl.meter.total.get = function () {
    return Q.all([
        Q.ninvoke(ctrl.read, "get", "meterTotal"),
        Q.ninvoke(ctrl.read, "get", "meterTotalDelta")
    ]).then(function (replies) {
        var data = JSON.parse(replies[0]);

        data.description = "Current Power meter total registered on server";
        data.version = ctrl.version;
        data.delta = replies[1];
    
        return data;
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

/**
 * Helper function to set seconds, minutes and hours to 0 on a date used for
 * lookup in the redis database. Actually a result of factoring out 5 lines of
 * code in the kwh.handler function :/.
 *
 * @param date Date the date that is now.
 * @param level String to what level we normalise
 * @returns *
 * @private
 */
ctrl._normalizeDate = function (date, level) {
    "use strict";
    level = typeof level === "undefined" ? 'millis' : level;
    var levels = {
        'hour':    3,
        'day':     4,
        'week':    5
    };

    if (! levels.hasOwnProperty(level)) {
        throw new Error("parameter level not set to one of the default values");
    }

    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(0);

    if (levels[level] < 4) return date;
    date.setHours(0);

    if (levels[level] < 5) return date;
    // Spool date to first day of the week.
    date.setDate(( date.getDate() - date.getDay() ));

    return date;
};

power.controller = ctrl;
module.exports = power;

/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2015 Thomas Malt <thomas@malt.no>
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

