/**
 * Power Meter API controller object.
 *
 * Power meter app. An express frontend to reading a power meter with a
 * flashing led using a photo resistive sensor on an Arduino Uno board.
 *
 * This is most of all a toy experiment to get me up to speed on some of
 * the latest web technologies.
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright 2015-2017 (c) Thomas Malt <thomas@malt.no>
 */

const debug = require('debug')('power-meter:controller');
const config = require('../config');
const EventEmitter = require('events').EventEmitter;
const version = require('../package').version;

// ctrl.version = version;

debug('Running Power Meter API v' + version);
debug('Getting ready to connect to redis: ' + config.redis.host);

class PowerMeterController extends EventEmitter {
  constructor(redis) {
    super();
    this.version = version;
    this.db = redis;
    this.monthName = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
  }

  /**
   * Returns a resolved promise with the list of watts used per second
   * for the last hour.
   *
   * @returns {Promise} contain json
   */
  getWattPerSecondLastHour() {
    debug('/power/watts/hour - lrange hours');
    return this.db.lrangeAsync('minutes', -60, -1)
      .then( values => values.map(i => JSON.parse(i)))
      .then( values => ({
        description: 'Average watts per minute over an hour.',
        version: this.version,
        container: 'Array',
        items: values
      }));
  }

  /**
   * Returns the current power usage in watts
   *
   * @param {integer} interval then number of seconds to get data for
   * @return {Promise} the resolved promise with json data
   */
  getWatts(interval = 1) {
    return this.db.lrangeAsync('seconds', (interval * -1), -1)
     .then(values => values.map(JSON.parse))
     .then(values => {
       const sum  = values.reduce((a, b) => a + b.watt, 0);
       const max  = values.reduce((a, b) => a > b.watt ? a : b.watt, 0);
       const min  = values.reduce((a, b) => a < b.watt ? a : b.watt, 2147483648);
       const watt = (sum / values.length);

       return {
         description: 'Current Usage in Watts, averaged over interval seconds',
         version: this.version,
         interval, watt, max, min
       };
     });
  }

  /**
   * Handler for fetching the kwh consumption for various intervals.
   * Supports:
   *   kwh/:type/:count
   *   kwh/today
   *   kwh/hour/:count
   *   kwh/day/:count
   *   kwh/week/:count
   *
   * @param {string} type the type
   * @param {intenger} count the number of items to fetch.
   * @returns {Promise} a resolved promise with data.
   */
  handleKwh(type, count = 1) {
    const keywords = ['seconds', 'today', 'hour', 'day', 'week', 'month', 'year'];

    if (keywords.indexOf(type) < 0) {
      throw new TypeError(
        'first argument must be a string with one of the keywords: ' +
        keywords.toString()
      );
    }

    switch (type) {
      case 'seconds':
        return this.getKwhSeconds(count);
      case 'today':
        return this.getKwhToday();
      case 'hour':
        return this.getKwhHour(count);
      case 'day':
        return this.getKwhDay(count);
      case 'week':
        return this.getKwhWeek(count);
      default:
        return (count === 'this')
          ? this.getCurrentMonth()
          : this.getMonths(count);
    }
  }

  /**
   * Returns the kwh consumption for today
   *
   * @return {Promise} resolved promise with json
   */
  getKwhToday() {
    const now = new Date();
    const start = this.normalizeDate((new Date()), 'day');
    const diff = now.getTime() - start.getTime();
    const range = Math.round(diff / (60000));

    debug('ctrl.kwh.today: range: ' + range);

    return this.db.lrangeAsync('minutes', (range * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        const sum = values.reduce((a, b) => (a + b.kwh), 0);

        return {
          description: 'kWh used today from midnight to now.',
          version: this.version,
          date: now.toJSON(),
          kwh: parseFloat(sum.toFixed(4))
        };
      });
  }

  getCurrentMonth() {
    const date = new Date();
    const days = date.getDate();

    debug('ctrl.kwh.currentMonth: days:', days);

    return this.db.lrangeAsync('days', ((days - 2) * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => values.reduce((a, b) => (a + b.kwh), 0))
      .then(kwh => (this.getKwhToday().then(today => kwh + today.kwh)))
      .then(kwh => parseFloat(kwh.toFixed(4)))
      .then(kwh => ({
        description: (
          'kWh used so far this month, ' +
          this.monthName[date.getMonth()] + ' ' + date.getFullYear()
        ),
        version: this.version,
        date: date.toJSON(),
        kwh: kwh
      }));
  }

  /**
   * Adding a controller to fetch out seconds for graphs.
   * @param {integer} count number of seconds to fetch.
   * @return {Promise} resolved promise with json
   */
  getKwhSeconds(count) {
    return this.db.lrangeAsync('seconds', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        const summary = {kwh: {}, watts: {}};

        summary.kwh.total   = values.reduce((a, b) => (a + b.kwh), 0);
        summary.kwh.average = summary.kwh.total / values.length;
        summary.kwh.max = values.reduce((a, b) => ((a > b.kwh) ? a : b.kwh), 0);
        summary.kwh.min = values.reduce((a, b) => ((a < b.kwh) ? a : b.khw), 2147483648);
        summary.watts.total = values.reduce((a, b) => (a + b.watt), 0);
        summary.watts.average = summary.watts.total / values.length;
        summary.watts.max = values.reduce((a, b) => ((a > b.watt) ? a : b.watt), 0);
        summary.watts.min = values.reduce((a, b) => ((a < b.watt) ? a : b.watt), 2147483648);

        delete summary.watts.total;
        return [summary, values];
      })
      .then((summary, values) => {
        const date = new Date();
        return {
          description: 'kWh and Watt consumption per second for ' + count + ' seconds',
          count: count,
          time: date.toJSON(),
          timestamp: date.getTime(),
          summary: summary,
          list: values
        };
      });
  }

  /**
   * Returns the kwh consumed for a number of hours (default 1)
   * @param {integer} count number of hours
   * @return {Promise} resolved promise
   */
  getKwhHour(count) {
    debug('running power.kwh.hour: ' + count);

    return this.db.lrangeAsync('hours', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        const summary = this.getCalculatedKwhSummary(values);
        summary.description = 'kWh consumption per hour for ' + count + ' hours';
        summary.count = count;
        return summary;
      });
  }

  getKwhDay(count) {
    debug('DEBUG Running power.kwh.day: ' + count);

    return this.db.lrangeAsync('days', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => this.getKwhransformPerMinute(values, 'perHour'))
      .then(values => this.transformCountToKwh(values, 'perHour'))
      .then(values => this.getCalculatedKwhSummary(values))
      .then(summary => {
        summary.description = (
          'kWh consumption per day for ' + count + ' days'
        );
        summary.count = count;

        return summary;
      });
  }

  getKwhWeek(count) {
    return this.db.lrangeAsync('weeks', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => this.getKwhransformPerMinute(values, 'perDay'))
      .then(values => this.transformCountToKwh(values, 'perDay'))
      .then(values => this.getCalculatedKwhSummary(values))
      .then(summary => {
        summary.description = 'kWh consumption per week for ' + count + ' weeks';
        summary.count = count;

        return summary;
      });
  }

  getKwhMonth(count) {
    debug('DEBUG Running power.kwh.month: ' + count);
    return this.db.lrangeAsync('months', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => this.getKwhTransformPerMinute(values, 'perDay'))
      .then(values => values.map(item => {
        item.perDay = item.perDay.map(day => parseFloat((day / 10000).toFixed(4)));
        return item;
      }))
      .then(values => {
        const summary = this.getCalculatedKwhSummary(values);
        summary.description = 'kWh consumption per month for ' + count + ' months';
        summary.count = count;

        return summary;
      });
  }

  getCalculatedKwhSummary(values) {
    const summary = {
      total: values.reduce((a, b) => (a + b.kwh), 0),
      max: values.reduce((a, b) => (a > b.kwh ? a : b.kwh), 0),
      min: values.reduce((a, b) => (a < b.kwh ? a : b.kwh), Number.MAX_VALUE),
      list: values
    };

    summary.average = parseFloat((summary.total / values.length).toFixed(4));
    summary.total   = parseFloat((summary.total).toFixed(4));

    return summary;
  }

  transformCountToKwh(values, prop) {
    return values.map(item => {
      item[prop] = item[prop].map(value => parseFloat((value / 10000).toFixed(4)));
      return item;
    });
  }

  getKwhTransformPerMinute(items, prop) {
    return items.map(item => {
      if (!(item.hasOwnProperty(prop)) && item.hasOwnProperty('perMinute')) {
        item[prop] = item.perMinute;
        delete item.perMinute;
      }
      return item;
    });
  }

  getKwhByDate(opts) {
    debug('ctr.kwh.byDate: ', opts);

    if (!opts.hasOwnProperty('year')) {
      throw new TypeError('Usage: /power/kwh/:year/:month/:date ' +
        'URI must be called with at least :year as argument. ');
    }

    return this.kwhHandleYear(opts)
      .catch(error => {
        debug('got error:', error.name, error.message);
        return {error: error.name, message: error.message};
      });
  }

  kwhHandleYear(opts) {
    debug('ctrl.kwh.handleYear');
    const now = new Date();

    if (opts.year < 2015 || opts.year > now.getFullYear()) {
      throw new RangeError('Usage: /power/kwh/:year/:month/:date ' +
        'Year must be between 2015 and ' + now.getFullYear());
    }

    if (!opts.hasOwnProperty('month')) return this.kwhHandleMonth(opts);

    return this.db.hexistsAsync('2016', 'data').then(result => ({result}));
  }

  kwhHandleMonth(opts) {
    debug('ctrl.kwh.handleMonth');
    const month = parseInt(opts.month, 10);

    if (isNaN(month) || month < 1 || month > 12) {
      throw new RangeError(
        'Usage: /power/kwh/:year/:month/:date ' +
        ':month must be an integer between 01 and 12'
      );
    }

    if (opts.hasOwnProperty('date'))  return this.kwhHandleDate(opts);

    return this.getKwhMonthData(opts);
  }

  getKwhMonthData(opts) {
    return this.db.lrangeAsync('months', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(data => this.getKwhTransformPerMinute([data], 'perDay'))
      .then(values => {
        debug('  Fetching month from range: length:', values.length);
        const testMonth = parseInt(opts.month, 10) - 1;

        let result = false;
        values.forEach(item => {
          const itemDate = new Date(item.timestamp);
          itemDate.setMonth(itemDate.getMonth() - 1);

          const itemMonth = itemDate.getMonth();
          const itemYear = itemDate.getFullYear();

          if (itemYear === opts.year && itemMonth === testMonth) {
            debug('    Found match: ', itemMonth, testMonth);
            result = item;
          }
        });
        return result;
      })
      .then(data => {
        if (data === false) {
          throw new Error('Did not find any data stored for that Month. ' +
          'Might be outside range of what is stored.');
        }

        return data;
      })
      .then(function (data) {
        debug('    Got data. Cleaning up');
        delete data.total;

        data.perDay = data.perDay.map(day => parseFloat((day / 10000).toFixed(4)));

        const date = new Date(data.timestamp);
        date.setMonth(date.getMonth() - 1);

        const month = date.getMonth();
        const year = date.getFullYear();

        data.description = (
          'kWh usage for ' + this.monthName[month] + ', ' + year
        );

        return data;
      });
  }

  kwhHandleDate(opts) {
    debug('ctrl.kwh.handleDate', opts);

    let day = parseInt(opts.date, 10);
    let month = parseInt(opts.month, 10);

    if (isNaN(day) || day < 1 || day > 31) {
      throw new RangeError(
        ':day must be an Integer in the range between 1 and 31. ' +
        'Usage: /power/kwh/:year/:month/:day'
      );
    }

    if (month < 10) month = '0' + month;
    if (day < 10)   day   = '0' + day;

    return this.db.hgetAsync(opts.year, month)
      .then(input => {
        if (input === null) {
          return this.kwhGetFromRangeForDate(opts)
            .then(this.kwhTransformDayItem)
            .then(this.kwhSaveDateInHash);
        }

        const result = JSON.parse(input);
        if (!result.hasOwnProperty(day)) {
          debug('  hash exists, but not for correct date');
          return this.kwhGetFromRangeForDate(opts)
            .then(this.kwhTransformDayItem)
            .then(this.kwhSaveDateInHash);
        }

        debug('  has exists. correct day exists');
        return result[day];
      });
  }

  kwhSaveDateInHash(args) {
    const data = args.data;
    const opts = args.opts;

    debug('ctrl.kwh.saveDateInHash');

    this.db.hgetAsync(opts.year, opts.month)
      .then(hash => (hash === null) ? {} : JSON.parse(hash))
      .then(hash => {
        debug('    HGET: hash', hash);
        hash[opts.date] = data;
        return hash;
      })
      .then(hash => {
        debug('    HSET data');
        this.db.hsetAsync(opts.year, opts.month, JSON.stringify(hash)).done();
      });

    return data;
  }

  kwhGetFromHashForDate(opts) {
    return this.db.hgetAsync(opts.year, opts.month)
      .then(data => JSON.parse(data))
      .then(data => data[opts.date]);
  }

  kwhTransformDayItem(args) {
    const opts = args.opts;
    const data = args.data;

    delete data.total;

    if (!(data.hasOwnProperty('perHour')) && data.hasOwnProperty('perMinute')) {
      data.perHour = data.perMinute;
      delete data.perMinute;
    }

    data.perHour = data.perHour.map(function (hour) {
      return parseFloat((hour / 10000).toFixed(4));
    });

    data.description = (
      'kWh usage for date: ' + opts.year + '-' + opts.month + '-' + opts.date
    );

    return {opts: opts, data: data};
  }

  kwhGetFromRangeForDate(opts) {
    return this.db.lrangeAsync('days', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        debug('inside lrange: ', values.length);

        let result = false;
        values.foreach(item => {
          const testDate = new Date(item.timestamp);
          testDate.setDate((testDate.getDate() - 1));
          const month = parseInt(opts.month, 10) - 1;

          if (testDate.getMonth() !== month) return false;
          if (testDate.getDate() !== parseInt(opts.date, 10)) return false;

          result = {data: item, opts: opts};
          return true;
        });
        if (result === false) {
          throw new RangeError(
            'Date was not found in database. Are you sure the day is correct?'
          );
        }

        return result;
      });
  }

  /**
   * Updates the meter total reading in the database.
   *
   * @param {float} value to set meter to
   * @returns {Promise} the resolved promise
   */
  putMeterTotal(value) {
    debug('starting ctrl.meter.total.put: ', value);
    if (typeof value !== 'number' || isNaN(value)) {
      throw new TypeError(
        `Value (${value}) passed as argument must be a valid Integer or Float.`
      );
    }

    return this.db.getAsync('meterTotal')
      .then(total => {
        const data = {
          timestamp: (new Date()).toJSON(),
          newValue: parseFloat(value),
          oldValue: parseFloat(total)
        };
        debug('  current: ', total);
        debug('      new: ', value);

        if (isNaN(data.newValue)) {
          throw new TypeError(
            'The value used must be a valid integer from the power meter'
          );
        }

        data.delta = parseFloat((data.newValue - data.oldValue).toFixed(4));

        return data;
      })
      .then(data => {
        return this.db.setAsync('meterTotal', data.newValue)
          .then( result => {
            debug('Updated meterTotal: ', result);
            data.result = result;

            return data;
          });
      })
      .then(data => {
        return this.db.rpushAsync('meterUpdates', JSON.stringify(data))
          .then(result => {
            debug('Added to meterUpdates:', result);
            data.meterUpdates = result;
            data.description = 'Updated meterTotal and updated statistics.';
            return data;
          });
      });
  }

  /**
   * Reads the meterTotal from the database and returns the json.
   *
   * @return {Promise} a resolved promise
   */
  getMeterTotal() {
    return this.db.getAsync('meterTotal')
      .then(function (reply) {
        debug('ctrl.meter.total.get: ', reply);
        const date = new Date();
        return {
          description: 'Current Power meter total registered on server',
          version: this.version,
          timestamp: date.getTime(),
          time: date.toJSON(),
          total: parseFloat(reply)
        };
      });
  }

  /**
   * Returns current usage in watts over a period in time:
   * GET /power/usage?duration=3600&interval=60
   *
   * @param {integer} duration number of seconds to fetch data for
   * @param {integer} interval interval to average over
   * @returns {Promise} a resolved promise with json.
   */
  getUsage(duration, interval) {
    const getSteps = list => {
      const steps = [];
      for (let i = 0; i < list.length; i = i + interval) {
        steps.push([i, i + interval]);
      }
      return steps;
    };

    const max = list => list.reduce((a, b) => (a > b ? a : b.watt), 0);
    const min = list => list.reduce((a, b) => (a < b ? a : b.watt), Number.MAX_VALUE);
    const average = list => (list.reduce((a, b) => (a + b.watt), 0) / list.length);

    return this.db.lrangeAsync('seconds', (duration * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        return getSteps().map(step => {
          const slice = values.slice(step[0], step[1]);
          return {
            max: max(slice),
            min: min(slice),
            average: average(slice)
          };
        });
      })
      .then(result => ({
        description: (
          `Usage for ${duration} seconds with ${interval} ` +
          'seconds average intervals.'
        ),
        values: result
      }));
  }

  /**
   * Helper function to set seconds, minutes and hours to 0 on a date used
   * for lookup in the redis database. Actually a result of factoring out
   * 5 lines of code in the kwh.handler function :/.
   *
   * level: 3 = set minutes to 0, 4 = set hours to 0, 5 = set to first day of week.
   *
   * @param {Date} date Date the date that is now.
   * @param {string} level String to what level we normalise
   * @returns {Date} a formatted date
   * @private
   */
  normalizeDate(date, level = 'millis') {
    const levels = {
      hour: 3,
      day: 4,
      week: 5
    };

    if (!levels.hasOwnProperty(level)) {
      throw new Error('ctrl.normalizeDate: parameter level not set to one of the default values');
    }

    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(0);

    if (levels[level] < 4) return date;

    date.setHours(0);

    if (levels[level] < 5) return date;

    // Spool date to first day of the week.
    date.setDate((date.getDate() - date.getDay()));

    return date;
  }
}

module.exports = PowerMeterController;

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
