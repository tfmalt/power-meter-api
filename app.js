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
 * jslint settings
 */
/*jslint node: true */
/*jslint ass: true */
/*jslint sloppy: true */
/*jslint vars: true */

var power      = require('./lib/power'),
    config     = require('./config'),
    logger     = require('winston'),
    express    = require('express'),
    // u          = require('underscore'),
    // events     = require('events'),
    VitalSigns = require('vitalsigns');
    //path       = require('path');

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize:  true,
    timestamp: true
});

var vitals = new VitalSigns();
vitals.monitor('cpu');
vitals.monitor('mem', {units: 'MB'});
vitals.monitor('tick');

var ctrl = power.controller;
var app  = express();

app.disable('x-powered-by');
app.use(express.logger());
app.use(express.bodyParser());

/**
 * Code to implement rudimentary CORS support.
 *
 * All requests are parsed through the cors validation.
 */
app.all('*', function (req, res, next) {
    "use strict";
    var origin = req.header('Origin');
    var index  = config.corsDomains.indexOf(origin);

    logger.info("Got origin: " + origin);

    if (index > -1) {
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
    }
    next();
});

app.get('/power/health', vitals.express);

app.get('/power/watts/:interval?', function (req, res) {
    if (req.params.interval === undefined || req.params.interval.match(/[0-9]+/)) {
        var interval = parseInt(req.params.interval, 10) || 5;
        ctrl.watts.get(interval).then(function (body) {
            logger.info("Got body returned as promised: ", body.length);
            res.setHeader('Cache-Control', 'public, max-age=1');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', body.length);
            res.end(body);
        });
    } else if (req.params.interval.match(/^hour$/)) {
        ctrl.watts.hour.get(req.params.type).then(function (body) {
            logger.info("Got body returned as promised");
            res.setHeader('Cache-Control', 'public, max-age=4');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', body.length);
            res.end(body);
        });
    }
});


app.get('/power/kwh/:type/:count?', function (req, res) {
    // req.params.resolution
    var maxage = {
        "today": 60,
        "hour":  5 * 60,
        "day":   10 * 60
    };

    var type  = req.params.type;
    var count = req.params.count || 1;

    ctrl.kwh.handler(type, count).then(function (body) {
        logger.info("Got body returned as promised: ", body.length);
        res.setHeader('Cache-Control', 'public, max-age=' + maxage[type]);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});

app.put('/power/meter/total', function (req, res) {
    logger.info("Got call to put /meter/total jj: ", req.body);
    logger.info(req.body);
    ctrl.meter.total.put(req.body.value).then(function (body) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});

/*jslint unparam: true */
app.get('/power/meter/total', function (req, res) {
    logger.info("Got get request to /meter/total");
    res.setHeader('Cache-Control', 'public, max-age=6');
    ctrl.meter.total.get().then(function (body) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});
/*jslint unparam: false */

app.listen(config.server.port || 3000);

logger.info("HTTP listening on port " + config.server.port);
logger.info("TZ: ", process.env.TZ);
logger.info("Running from: ", process.cwd());
logger.info("args: ", process.argv);

