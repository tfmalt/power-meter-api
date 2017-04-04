const debug   = require('debug')('power-meter:power');
const express = require('express');
const power   = express.Router();
const util    = require('../lib/power-meter-util');
const config  = util.config;

/**
 * Code to implement rudimentary CORS support.
 *
 * All requests are parsed through the cors validation.
 */
power.all('*', (req, res, next) => {
  debug('Doing CORS check');
  debug(req.headers);

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
  res.header('Access-Control-Max-Age', 86400);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');

  next();
});

power.get('/', (req, res) => {
  res.status(200)
    .json({
      message: 'power-meter-api is running properly',
      version: `v${config.version}`
    });
});

module.exports = power;
