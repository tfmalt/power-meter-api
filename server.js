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
const debug      = require('debug')('power-meter:server');
const config     = require('./config');
const logger     = require('morgan');
const bluebird   = require('bluebird');
const express    = require('express');
const bodyParser = require('body-parser');
const VitalSigns = require('vitalsigns');
const PowerMeterController = require('./lib/power-meter-controller');
const redis = require('redis');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

config.env            = process.env.NODE_ENV   || 'production';
config.server.port    = process.env.PORT       || config.server.port;
config.redis.host     = process.env.REDIS_HOST || config.redis.host;
config.redis.port     = process.env.REDIS_PORT || config.redis.port;
config.redis.password = process.env.REDIS_AUTH || config.redis.password;

if (config.redis.password === '') delete config.redis.password;

const redisclient = redis.createClient(config.redis);
redisclient.on('error', (error) => {
  debug('got error from redis server:', error.message, error);
  process.exit(1);
});
redisclient.on('ready', () => {
  debug('redis connection is woring and ready.');
});

const ctrl = new PowerMeterController(redisclient, config);
const vitals = new VitalSigns();

vitals.monitor('cpu', null);
vitals.monitor('mem', {units: 'MB'});
vitals.monitor('tick', null);

const app     = express();
const logmode = (process.env.NODE_ENV === 'development') ? 'dev' : 'combined';

app.use(logger(logmode));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.disable('x-powered-by');

const router = express.Router();

/**
 * Code to implement rudimentary CORS support.
 *
 * All requests are parsed through the cors validation.
 */
router.all('*', (req, res, next) => {
  // var origin = req.header('Origin');
  // var index  = config.corsDomains.indexOf(origin);

  debug('Doing CORS check');
  debug(req.headers);

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  res.header('Access-Control-Max-Age', 600);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');

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
router.get('/watts/:interval?', (req, res) => {
  if (!req.params.hasOwnProperty('interval') || req.params.interval.match(/[0-9]+/)) {
    const interval = parseInt(req.params.interval, 10) || 5;

    ctrl.watts.get(interval).done((body) => {
      res.setHeader('Cache-Control', 'public, max-age=1');
      res.json(body);
    });
  } else if (req.params.interval.match(/^hour$/)) {
    ctrl.watts.hour.get().done((body) => {
      res.setHeader('Cache-Control', 'public, max-age=4');
      res.json(body);
    });
  } else {
    res.status(400);
    res.json({error: 'Bad Request'});
  }
});

router.get('/kwh/date/:year?/:month?/:date?', (req, res) => {
  debug('/kwh/date');

  ctrl.kwh.byDate(req.params).done((data) => {
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
router.get('/kwh/:type/:count?', (req, res) => {
  const maxage = {
    seconds: 1,
    today:   60,
    hour:    5 * 60,
    day:     10 * 60,
    week:    10 * 60,
    month:   10 * 60,
    year:    10 * 60
  };

  const type = req.params.type;
  const count = req.params.count || 1;

  if (!maxage.hasOwnProperty(type)) {
    throw new TypeError('URI called with unsupported type');
  }

  if (count !== 'this') count = parseInt(count, 10);

  debug('count: ', count);
  if (!Number.isInteger(count) && count !== 'this') {
    throw new TypeError('last param must be an integer or a keyword. got: ' + count);
  }

  ctrl.kwh.handler(type, count).done(function (body) {
    res.setHeader('Cache-Control', 'public, max-age=' + maxage[type]);
    res.json(body);
  });
});

/**
 * PUT /power/meter/total
 */
router.put('/meter/total', function (req, res) {
  ctrl.meter.total.put(req.body.value).catch(function (error) {
    res.status(400);
    res.json({error: error.name, message: error.message});
  }).done(function (body) {
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

router.get('/usage', function (req, res) {
  const duration = req.query.duration || 60;
  const interval = req.query.interval || 5;

  debug('got usage: ', req.query);

  ctrl.usage.get(duration, interval).then(function (data) {
    res.json(data);
  });
});

/**
 * GET /power/test
 */
router.get('/test', function (req, res) {
  res.json({message: 'ok now this works'});
});

app.use('/power', router);

/**
 * error handler
 */
app.use((err, req, res, next) => {
  if (!err) return next();

  debug('got error: ', err);
  res.status(400);
  res.json({error: 'Bad Request', message: err.message});
  res.end();

  return false;
});

app.listen(config.server.port);

debug('HTTP  listening on port ' + config.server.port);
debug('TZ:   ', process.env.TZ);
debug('CWD:  ', process.cwd());
debug('ARGS: ', process.argv);

/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2017 Thomas Malt <thomas@malt.no>
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
