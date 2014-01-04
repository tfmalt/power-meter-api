/**
 * Power meter app. An express frontend to reading a power meter with a 
 * flashing led using a photo resistive sensor on an Arduino Uno board. 
 *
 * This is most of all a toy experiment to get me up to speed on some of
 * the latest web technologis.
 *
 * Copyright (c) 2013 Thomas Malt <thomas@malt.no>
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thommas Malt <thomas@malt.no>
 */

var power   = require('./lib/power'), 
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

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.static(
    path.dirname(process.argv[1]) + '/public', 
    {maxAge: 7*24*60*60*1000})
);

app.get('/usage/:interval?', function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=1');
    ctrl.handleCurrentUsage(req, res);
});

app.get('/hour/:type?', function (req, res) {
    res.setHeader('Cache-Control', 'public, max-age=2');
    ctrl.handleGetHour(req, res);
});

app.get('/kwh/:resolution/:count?', function (req, res) {
    // req.params.resolution
    var maxage = {
        "today": 60,
        "hour":  5*60,
        "day":   5*60
    };
    res.setHeader('Cache-Control', 'public, max-age='+maxage[req.params.resolution]);
    ctrl.kwh.handler(req, res);
});

app.put('/meter/total', function (req, res) {
    logger.info("Got call to put /meter/total jj: ");
    logger.info(req.body);
    ctrl.meter.total.put(req, res);
});

app.get('/meter/total', function (req, res) {
    logger.info("Got get request to /meter/total");
    res.setHeader('Cache-Control', 'public, max-age=10');
    ctrl.meter.total.get(req, res);
});

app.listen(3000);

logger.info("HTTP listening on port 3000");
logger.info("Running from: ", process.cwd());
logger.info("args: ", process.argv);

