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

      res.setHeader('Cache-Control', 'public, max-age=87400');
      res.json(data);
    });
});

route.get('/kwh/date/:year/:month/:day', kwh.handleDay);

module.exports = route;
