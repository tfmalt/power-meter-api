const debug   = require('debug')('power-meter:watts');
const express = require('express');
const watts   = express.Router();
const util    = require('../lib/power-meter-util');
const redis   = util.redis;

/**
 * Returns the list of watts used per second for the last hour.
 *
 * Syntax:
 *   GET /power/watts/hour - list of average watts per minute over an hour.
 */
watts.get('/watts/hour', (req, res) => {
  redis.lrangeAsync('minutes', -60, -1)
    .then(v => v.map(JSON.parse))
    .then(values => ({
      description: 'Average watts per minute over an hour.',
      version: util.version,
      container: 'Array',
      items: values
    }))
    .then((body) => {
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.json(body);
    });
});


/**
 * Returns the current power usage in watts
 * Returns the watts for a given interval, default is 5.
 *
 * Syntax:
 *   GET /power/watts/60
 *   GET /power/watts
 */
watts.get('/watts/:interval?', (req, res) => {
  req.params.interval = req.params.interval || '10';

  if (!req.params.interval.match(/[0-9]+/)) {
    throw new TypeError(
      'Invalid interval given to /watts/:interval?. It must either be an ' +
      'Integer representing seconds, or the keyword "hour".'
    );
  }

  const interval = parseInt(req.params.interval, 10);

  redis.lrangeAsync('seconds', Math.ceil(interval / 10) * -1, -1)
    .then(values => values.map(JSON.parse))
    .then(values => ({
      description: 'Current Usage in Watts, averaged over interval seconds',
      version: util.version,
      max:  util.maxWatt(values),
      min:  util.minWatt(values),
      watt: util.avgWatt(values),
      time: values[0].time,
      interval
    }))
    .then(body => {
      res.setHeader('Cache-Control', 'public, max-age=5');
      res.json(body);
    });
});

module.exports = watts;
