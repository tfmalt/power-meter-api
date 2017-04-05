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
 * @copyright 2015-2017 Thomas Malt <thomas@malt.no>
 *
 */

const debug                = require('debug')('power-meter:server');
const logger               = require('morgan');
const express              = require('express');
const bodyParser           = require('body-parser');
const PowerMeterController = require('./lib/power-meter-controller');
const util                 = require('./lib/power-meter-util');
const config               = util.config;

const ctrl = new PowerMeterController(util.redis, config);

const app     = express();
const logmode = (config.env === 'development') ? 'dev' : 'combined';

/* istanbul ignore if */
if (config.env !== 'test') app.use(logger(logmode));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.disable('x-powered-by');

const router = express.Router();

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

  if (!maxage.hasOwnProperty(req.params.type)) {
    throw new TypeError('/power/kwh/:type called with invalid type');
  }

  const type = req.params.type;
  let count = req.params.count || 1;
  if (count !== 'this') count = parseInt(count, 10);

  debug('count: ', count);

  if (!Number.isInteger(count) && count !== 'this') {
    throw new TypeError('last param must be an integer or a keyword. got: ' + count);
  }

  ctrl.handleKwh(type, count).then(body => {
    res.setHeader('Cache-Control', 'public, max-age=' + maxage[type]);
    res.json(body);
  });
});

/**
 * PUT /power/meter/total
 */
router.put('/meter/total', (req, res) => {
  ctrl.putMeterTotal(req.body.value).then(body => res.json(body));
});

/**
 * GET /power/meter/total
 */
router.get('/meter/total', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=6');
  ctrl.getMeterTotal().then(body => res.json(body));
});

/**
 * GET /power/test
 */
router.get('/test', function (req, res) {
  res.json({message: 'ok now this works'});
});

app.use('/power', router);
app.use('/power', require('./controllers/power'));
app.use('/power', require('./controllers/power-health'));
app.use('/power', require('./controllers/power-watts'));
app.use('/power', require('./controllers/power-kwh'));

/**
 * error handler
 */
app.use((err, req, res, next) => {
  /* istanbul ignore if */
  if (!err) return next();

  debug('got error: ', err);
  res.status(400);
  res.json({error: 'Bad Request', message: err.message});
  res.end();

  return false;
});

/* istanbul ignore if */
if (config.env !== 'test') app.listen(config.server.port);

debug('HTTP  listening on port ' + config.server.port);
debug('TZ:   ', process.env.TZ);
debug('CWD:  ', process.cwd());
debug('ARGS: ', process.argv);

module.exports = {
  app
};

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
