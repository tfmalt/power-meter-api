const express        = require('express');
const route          = express.Router();
const PowerMeterController = require('../lib/power-meter-controller');
const util           = require('../lib/power-meter-util');
const redis          = util.redis;
const ctrl = new PowerMeterController();

/**
 * PUT /power/meter/total
 */
route.put('/meter/total', (req, res) => {
  ctrl.putMeterTotal(req.body.value, redis).then(body => res.json(body));
});

/**
 * GET /power/meter/total
 */
route.get('/meter/total', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=6');
  ctrl.getMeterTotal(redis).then(body => res.json(body));
});

/**
 * GET /power/test
 */
route.get('/test', function (req, res) {
  res.json({message: 'ok now this works'});
});

module.exports = route;
