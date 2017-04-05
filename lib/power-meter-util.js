/**
 * Utilities library with functions which is nice to have.
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright 2017 (c) Thomas Malt
 */


const debug    = require('debug')('power-meter:server');
const config   = require('../config');
const version  = require('../package').version;
const redis    = require('redis');
const bluebird = require('bluebird');

config.version        = version;
config.env            = process.env.NODE_ENV   || 'production';
config.server.port    = process.env.PORT       || config.server.port;
config.redis.host     = process.env.REDIS_HOST || config.redis.host;
config.redis.port     = process.env.REDIS_PORT || config.redis.port;
config.redis.password = process.env.REDIS_AUTH || config.redis.password;

if (config.redis.password === '') delete config.redis.password;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const redisclient = redis.createClient(config.redis);

/* istanbul ignore next */
redisclient.on('error', (error) => {
  debug('got error from redis server:', error.message, error);
  process.exit(1);
});

redisclient.on('ready', () => {
  debug(`redis connection to ${config.redis.host} is working and ready.`);
});

const util = {
  get config() {
    return config;
  },

  get version() {
    return version;
  },

  get redis() {
    return redisclient;
  }
};

util.minWatt = v => v.reduce((a, b) => (a < b.watt) ? a : b.watt, Number.MAX_VALUE);
util.maxWatt = v => v.reduce((a, b) => (a > b.watt) ? a : b.watt, 0);
util.sumWatt = v => v.reduce((a, b) => a + b.watt, 0);
util.avgWatt = v => util.sumWatt(v) / v.length;
util.isValidYear = p => (parseInt(p, 10) > 0 && parseInt(p, 10) < 1000) ? true : false;
util.isYearInRange = y => (
  (y >= config.start.year && y <= (new Date()).getFullYear()) ? true : false
);
util.pulsesToKwh = v => v.map(i => parseFloat((i / 10000).toFixed(4)));

util.timestampToDate = t => {
  const d = new Date(t);
  return d.setDate(d.getDate() - 1);
};

util.monthName = number => (
  [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][number]
);

module.exports = util;
