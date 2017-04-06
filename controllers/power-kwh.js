const express        = require('express');
const route          = express.Router();
const PowerMeterKwh  = require('../lib/power-meter-kwh');
const util           = require('../lib/power-meter-util');
const kwh            = new PowerMeterKwh();
const redis          = util.redis;

route.get('/kwh/date', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=864000');
  res.json({
    version: util.version,
    description: 'Get power usage information for a given date, month or year.',
    usage: '/power/kwh/date/:year?/:month?:/day?'
  });
});

route.get('/kwh/date/:year', (req, res) => {
  kwh.assertYear(req.params.year);

  res.setHeader('Cache-Control', 'public, max-age=8640000');
  res.json({
    version: util.version,
    description: 'Get power usage for the entire year. No data yet.'
  });
});

route.get('/kwh/date/:year/:month', (req, res) => {
  kwh.handleDateMonth(req, res, redis)
    .then(data => {
      data.version = util.version;
      data.description = (
        `kWh usage for ${util.monthName(req.params.month)}, ${req.params.year}.`
      );

      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.json(data);
    })
    .catch(error => {
      const code = (error.name === 'RangeError') ? 404 : 500;

      res.status(code);
      res.json({error: error.name, message: error.message});
    });
});

route.get('/kwh/date/:year/:month/:day', (req, res) => {
  kwh.handleDay(req, res, redis)
    .then(data => {
      res.setHeader('Cache-Control', 'public, max-age=864000');
      res.json(data);
    })
    .catch(error => {
      const code = (error.name === 'RangeError') ? 404 : 500;

      res.status(code);
      res.json({error: error.name, message: error.message});
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
route.get('/kwh/:type/:count?', (req, res, next) => {
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

  if (!Number.isInteger(count) && count !== 'this') {
    throw new TypeError('last param must be an integer or a keyword. got: ' + count);
  }

  kwh.handleKwh(type, count, redis).then(body => {
    res.setHeader('Cache-Control', 'public, max-age=' + maxage[type]);
    res.json(body);
  });
});

module.exports = route;
