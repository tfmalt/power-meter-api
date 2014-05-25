/**
 * Power meter app. An express frontend to reading a power meter with a 
 * flashing led using a photo resistive sensor on an Arduino Uno board. 
 *
 * This is most of all a toy experiment to get me up to speed on some of
 * the latest web technologis.
 *
 * Copyright (c) 2013-2014 Thomas Malt <thomas@malt.no>
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thommas Malt <thomas@malt.no>
 */

var power   = require('./lib/power'), 
    config  = require('./config-private');
    logger  = require('winston'), 
    express = require('express'),
    u       = require('underscore'),
    events  = require('events'),
    path    = require('path');

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize:  true, 
    timestamp: true
});

var ctrl  = power.controller;

var app = express();

app.disable('x-powered-by');
app.use(express.logger());
app.use(express.bodyParser());

// Code to implement rudimentary CORS support.
app.all('*', function (req, res, next) {
    var origin = req.header('Origin');
    var index  = config.corsDomains.indexOf(origin);

    logger.info("Got origin: " + origin);

    if (index > -1) {
        res.header(
            "Access-Control-Allow-Origin", 
            config.corsDomains[index]
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


app.get('/power/watts/:interval?', function (req, res) {
    if (req.params.interval === undefined || req.params.interval.match(/[0-9]+/)) {
        var interval = parseInt(req.params.interval) || 5;
        ctrl.watts.get(interval).then( function (body) {
            logger.info("Got body returned as promised: ", body.length);
            res.setHeader('Cache-Control', 'public, max-age=1');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Length', body.length);
            res.end(body);
        });
    }
    else if (req.params.interval.match(/^hour$/)) {
        ctrl.watts.hour.get(req.params.type).then( function (body) {
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
        "hour":  5*60,
        "day":   5*60
    };
    
    var type  = req.params.type;
    var count = req.params.count || 1;

    ctrl.kwh.handler(type, count).then(function (body) { 
        logger.info("Got body returned as promised: ", body.length);
        res.setHeader('Cache-Control', 'public, max-age='+maxage[type]);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});

app.put('/power/meter/total', function (req, res) {
    logger.info("Got call to put /meter/total jj: ");
    logger.info(req.body);
    ctrl.meter.total.put(req.body.value).then(function (body) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});

app.get('/power/meter/total', function (req, res) {
    logger.info("Got get request to /meter/total");
    res.setHeader('Cache-Control', 'public, max-age=4');
    ctrl.meter.total.get().then(function (body) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    });
});

app.listen(config.server.port || 3000);

logger.info("HTTP listening on port " + config.server.port);
logger.info("Running from: ", process.cwd());
logger.info("args: ", process.argv);

