/**
 * Power meter api server.
 *
 * An express frontend to reading a power meter with a
 * flashing led using a photo resistive sensor on an Arduino Uno board. 
 *
 * This is most of all a toy experiment to keep me up to speed on some of
 * the latest web technologies.
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 *
 */

var power      = require('./lib/power'),
    config     = require('./config'),
    logger     = require('morgan'),
    express    = require('express'),
    bodyParser = require('body-parser'),
    VitalSigns = require('vitalsigns');

// Configuring vitalsigns to have a statistics service running.
var vitals = new VitalSigns();
vitals.monitor('cpu', null);
vitals.monitor('mem', {units: 'MB'});
vitals.monitor('tick', null);

var ctrl = power.controller;
var app  = express();
var logMode = "combined";

if (config.environment === "development") {
    logMode = "dev";
}


app.use(logger(logMode));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.disable('x-powered-by');

var router = express.Router();
var google = express.Router();

/**
 * Code to implement rudimentary CORS support.
 *
 * All requests are parsed through the cors validation.
 */
router.all('*', function (req, res, next) {
    "use strict";
    // var origin = req.header('Origin');
    // var index  = config.corsDomains.indexOf(origin);

    console.log("DEBUG: Doing CORS check");
    console.log(req.headers);

    res.header(
        "Access-Control-Allow-Origin",
        "*"
    );
    res.header(
       "Access-Control-Allow-Headers",
       "X-Requested-With, Content-Type"
    );
    res.header("Access-Control-Max-Age", 600);
    res.header("Access-Control-Allow-Methods",  "GET, PUT, OPTIONS");

    next();
});


/**
 * Health statistics web-service. returns the result from vitals express.
 */
router.get('/health', vitals.express);

/**
 * Returns the watts for a given interval, default is 5.
 *
 * Syntax:
 *   GET /power/watts/:interval
 *   GET /power/watts/10 - average watt consumption during 10 seconds
 *   GET /power/watts/hour - list of average watts per minute over an hour.
 */
router.get('/watts/:interval?', function (req, res) {
    if (req.params.interval === undefined || req.params.interval.match(/[0-9]+/)) {
        var interval = parseInt(req.params.interval, 10) || 5;

        ctrl.watts.get(interval).done(function(body) {
            res.setHeader('Cache-Control', 'public, max-age=1');
            res.json(body);
        });
    } else if (req.params.interval.match(/^hour$/)) {
        ctrl.watts.hour.get().done(function(body) {
            res.setHeader('Cache-Control', 'public, max-age=4');
            res.json(body);
        });
    } else {
        res.status(400);
        res.json({error: 'Bad Request'});
    }
});


router.get('/kwh/date/:year?/:month?/:date?', function (req, res) {
    console.log('/kwh/date');

    ctrl.kwh.byDate(req.params)
        .done(function (data) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.json(data);
        });
});

/**
 * Main handler for all the kwh routines.
 *
 * Syntax:
 *   GET /power/kwh/:type/:count
 *   GET /power/kwh/seconds
 *   GET /power/kwh/hour
 *   GET /power/kwh/today
 *   GET /power/kwh/day
 *   GET /power/kwh/week
 *   GET /power/kwh/month - not implemented yet
 *   GET /power/kwh/year - not implemented yet
 */
router.get('/kwh/:type/:count?', function (req, res) {
    var maxage = {
        "seconds": 1,
        "today": 60,
        "hour":  5 * 60,
        "day":   10 * 60,
        "week":  10 * 60,
        "month": 10 * 60,
        "year":  10 * 60
    };

    var type  = req.params.type;
    var count = req.params.count;

    if (! maxage.hasOwnProperty(type)) {
        throw new TypeError('URI called with unsupported type');
    }

    if (count === undefined) { count = 1; }
    if (count !== "this")    { count = parseInt(count); }

    console.log("count: ", count);
    if (!Number.isInteger(count) && count !== "this") {
        throw new TypeError("last param must be an integer or a keyword. got: " + count);
    }

    ctrl.kwh.handler(type, count)
        .done(function (body) {
            res.setHeader('Cache-Control', 'public, max-age=' + maxage[type]);
            res.json(body);
        });
});

/**
 * PUT /power/meter/total
 */
router.put('/meter/total', function (req, res) {
    ctrl.meter.total.put(req.body.value)
        .catch(function (error) {
            res.status(400);
            res.json({
                'error': error.name,
                'message': error.message
            });
        })
        .done(function (body) {
            res.json(body);
        });
});

/**
 * GET /power/meter/total
 */
router.get('/meter/total', function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=6');

    ctrl.meter.total.get().then(function (body) {
        res.json(body);
    });
});


/**
 * GET /power/test
 */
router.get('/test', function (req, res) {
    res.json({ message: 'ok now this works'});
});

/**
 * Setup to verify site by google.
 */
google.get('/google8f7fa95b45f4eba4.html', function (req, res) {
    "use strict";
    res.setHeader('Content-Type', 'text/plain');
    res.send("google-site-verification: google8f7fa95b45f4eba4.html");
});

app.use('/power', router);
app.use('/', google);


/**
 * error handler
 */
app.use(function(err, req, res, next) {
    "use strict";
    if (!err) return next();
    console.log("got error: ", err);
    res.status(400);
    res.json({
        error: 'Bad Request',
        message: err.message
    });
    res.end();
});

app.listen(config.server.port);

console.log("HTTP  listening on port " + config.server.port);
console.log("TZ:   ", process.env.TZ);
console.log("CWD:  ", process.cwd());
console.log("ARGS: ", process.argv);

/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2016 Thomas Malt <thomas@malt.no>
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

