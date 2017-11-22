const express    = require('express');
const health     = express.Router();
const VitalSigns = require('vitalsigns');

const vitals     = new VitalSigns();

vitals.monitor('cpu', null);
vitals.monitor('mem', {units: 'MB'});
vitals.monitor('tick', null);

/**
 * Health statistics web-service. returns the result from vitals express.
 */
health.get('/health', vitals.express);

module.exports = health;
