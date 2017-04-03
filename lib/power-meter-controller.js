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
    return this.getRangeFromEnd(60, 'minutes')
      .then(values => ({
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
    return this.getSecondsRangeFromEnd(interval)
     .then(values => {
       const sum  = values.reduce((a, b) => a + b.watt, 0);
       const max  = values.reduce((a, b) => a > b.watt ? a : b.watt, 0);
       const min  = values.reduce((a, b) => a < b.watt ? a : b.watt, Number.MAX_VALUE);
       const watt = (sum / values.length);
       const time = values[0].time;

       return {
         description: 'Current Usage in Watts, averaged over interval seconds',
         version: this.version,
         interval, watt, max, min, time
       };
     });
  }

  /**
   * @param {integer} count number of items to fetch
   * @param {integer} list which list to fetch from
   * @return {Promise} json of items from that list.
   * @private
   */
  getRangeFromEnd(count = 1, list = 'hours') {
    return this.db.lrangeAsync(list, count * -1, -1).then(v => v.map(JSON.parse));
  }

  /**
   * Helper function to bootstrap fetching a range of seconds from the end
   * of the list. Assumes the backend stores data in 10 seconds increment
   * (it does).
   *
   * @param {integer} count the length of the range in seconds
   * @return {Promise} a resolved promise with parsed JSON
   */
  getSecondsRangeFromEnd(count = 1) {
    return this.getRangeFromEnd(Math.ceil(count / 10), 'seconds');
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
          : this.getKwhMonth(count);
    }
  }

  /**
   * Returns the kwh consumption for today
   *
   * @return {Promise} resolved promise with json
   */
  getKwhToday() {
    const now   = new Date();
    const start = this.normalizeDate((new Date()), 'day');
    const diff  = now.getTime() - start.getTime();
    const range = Math.round(diff / (60000));

    debug('ctrl.kwh.today: range: ' + range);

    return this.getRangeFromEnd(range, 'minutes')
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

    return this.getRangeFromEnd(days - 2, 'days')
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
   * Interval is now defined to be 10 seconds.
   *
   * @param {integer} count number of seconds to fetch.
   * @return {Promise} resolved promise with json
   */
  getKwhSeconds(count) {
    return this.getSecondsRangeFromEnd(count)
      .then(values => {
        const summary = {kwh: {}, watts: {}};

        summary.kwh.total     = parseFloat((values.reduce((a, b) => (a + b.kwh), 0)).toFixed(4));
        summary.kwh.average   = parseFloat((summary.kwh.total / values.length / 10).toFixed(4));
        summary.kwh.max       = parseFloat((values.reduce(
          (a, b) => ((a > b.kwh) ? a : b.kwh), 0
        ) / 10).toFixed(4));
        summary.kwh.min       = parseFloat((values.reduce(
          (a, b) => ((a < b.kwh) ? a : b.kwh), Number.MAX_VALUE
        ) / 10).toFixed(4));
        summary.watts.total   = values.reduce((a, b) => (a + b.watt), 0);
        summary.watts.average = parseInt(summary.watts.total / values.length, 10);
        summary.watts.max     = parseInt((values.reduce(
          (a, b) => ((a > b.watt) ? a : b.watt), 0)
        ), 10);
        summary.watts.min     = parseInt((values.reduce(
          (a, b) => ((a < b.watt) ? a : b.watt), Number.MAX_VALUE)
        ), 10);

        delete summary.watts.total;
        return {summary, values};
      })
      .then(data => {
        const date = new Date();
        return {
          description: 'kWh and Watt consumption per second for ' + count + ' seconds',
          count: count,
          time: date.toJSON(),
          timestamp: date.getTime(),
          summary: data.summary,
          list: data.values
        };
      });
  }

  /**
   * Returns the kwh consumed for a number of hours (default 1)
   * @param {integer} count number of hours
   * @return {Promise} resolved promise
   */
  getKwhHour(count = 1) {
    debug('running power.kwh.hour: ' + count);

    return this.getRangeFromEnd(count, 'hours')
      .then(values => {
        const summary = this.getCalculatedKwhSummary(values);
        summary.description = 'kWh consumption per hour for ' + count + ' hours.';

        if (summary.list.length !== count) {
          summary.description = summary.description +
            ` ${count} hours was asked for, but only ${summary.list.length}` +
            ' hours was found.';
        }

        summary.count = summary.list.length;
        return summary;
      });
  }

  /**
   * Fetch number of days from database and return api friendly json
   *
   * @param {Integer} count number of days to fetch.
   * @return {Promise} resolved promise with json.
   */
  getKwhDay(count = 1) {
    debug('DEBUG Running power.kwh.day: ' + count);

    return this.getRangeFromEnd(count, 'days')
      .then(values => this.transformCountToKwh(values, 'perHour'))
      .then(values => this.getCalculatedKwhSummary(values))
      .then(summary => {
        summary.description = (
          `kWh consumption per day for ${summary.list.length} days.`
        );
        if (summary.list.length !== count) {
          summary.description = summary.description +
            ` ${count} days was asked for, but only ${summary.list.length}` +
            ' days was found.';
        }
        summary.count = summary.list.length;

        return summary;
      });
  }

  /**
   * Fetch number of weeks from database and return api friendly json
   *
   * @param {Integer} count number of weeks to Fetch
   * @return {Promise} resolved promise with json
   */
  getKwhWeek(count = 1) {
    return this.getRangeFromEnd(count, 'weeks')
      .then(values => this.transformCountToKwh(values, 'perDay'))
      .then(values => this.getCalculatedKwhSummary(values))
      .then(summary => {
        summary.description = `kWh consumption per week for ${summary.list.length} weeks.`;
        if (summary.list.length !== count) {
          summary.description = summary.description +
            ` ${count} weeks was asked for, but only ${summary.list.length}` +
            ' weeks was found.';
        }
        summary.count = summary.list.length;

        return summary;
      });
  }

  /**
   * Fetch number of months from database and return api friendly json
   *
   * @param {Integer} count number of months to Fetch
   * @return {Promise} resolved promise with json
   */
  getKwhMonth(count) {
    debug('DEBUG Running power.kwh.month: ' + count);
    return this.getRangeFromEnd(count, 'months')
      .then(values => values.map(item => {
        item.perDay = item.perDay.map(day => parseFloat((day / 10000).toFixed(4)));
        return item;
      }))
      .then(values => {
        const summary = this.getCalculatedKwhSummary(values);
        summary.description = 'kWh consumption per month for ' + count + ' months';
        if (summary.list.length !== count) {
          summary.description = summary.description +
            ` ${count} months was asked for, but only ${summary.list.length}` +
            ' months was found.';
        }
        summary.count = summary.list.length;

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

  /**
   * Handler to return the power usage for a given date, month or year
   *
   * @param {object} opts params parsed from the get request.
   * @return {Promise} resolved promise with json.
   */
  getKwhByDate(opts) {
    debug('ctr.kwh.byDate: ', opts);

    if (typeof opts.year === 'undefined') {
      throw new TypeError('Usage: /power/kwh/:year/:month/:date ' +
        'URI must be called with at least :year as argument. ');
    }

    if (typeof opts.month === 'undefined') delete opts.month;
    if (typeof opts.date  === 'undefined') delete opts.date;

    return this.kwhHandleYear(opts);
  }

  kwhHandleYear(opts) {
    debug('ctrl.kwh.handleYear');
    const now = new Date();

    if (opts.year < 2017 || opts.year > now.getFullYear()) {
      throw new RangeError('Usage: /power/kwh/:year/:month/:date ' +
        'Year must be between 2017 and ' + now.getFullYear());
    }

    if (opts.hasOwnProperty('month')) return this.kwhHandleMonth(opts);

    return this.db.hexistsAsync(opts.year, 'data').then(() => ({
      version: this.version,
      description: 'Fetch power usage for an entire year. No data yet.'
    }));
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

    const today = new Date();
    if (opts.year >= today.getFullYear() && month > today.getMonth()) {
      throw new RangeError(
        'Date is in the future. Please provide a date in the past.'
      );
    }

    if (opts.hasOwnProperty('date')) return this.kwhHandleDate(opts);
    return this.getKwhMonthData(opts)
      .catch(error => {
        throw new RangeError(
           'Got error when fetching data for month: ' +
           error.message
        );
      });
  }

  getKwhMonthData(opts) {
    return this.db.lrangeAsync('months', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        debug('  Fetching month from range: length:', values.length);
        const testMonth = parseInt(opts.month, 10) - 1;
        const testYear  = parseInt(opts.year, 10);

        let result = false;
        values.forEach(item => {
          const itemDate = new Date(item.timestamp);
          itemDate.setMonth(itemDate.getMonth() - 1);

          const itemMonth = itemDate.getMonth();
          const itemYear = itemDate.getFullYear();

          if (itemYear === testYear && itemMonth === testMonth) {
            debug('    Found match: ', itemMonth, testMonth);
            result = item;
          }
        });
        return result;
      })
      .then(data => {
        if (data === false) {
          throw new Error(
            'Did not find any data stored for that Month. ' +
            'Might be outside range of what is stored.'
          );
        }

        return data;
      })
      .then(data => {
        debug('    Got data. Cleaning up');
        delete data.total;
        data.perDay = data.perDay.map(day => parseFloat((day / 10000).toFixed(4)));
        const date = new Date(data.timestamp);
        date.setMonth(date.getMonth() - 1);
        const month = this.monthName[date.getMonth()];
        const year = date.getFullYear();
        data.description = `kWh usage for ${month}, ${year}.`;
        return data;
      })
      .catch(error => {
        // console.log('dealt with the error: ' + error.message);
        throw error;
      });
  }

  /**
   * Fetches kwh usage data for a given date.
   *
   * @param {object} opts hash with the keys year, month, date
   * @return {Promise} resolved promise with data.
   */
  kwhHandleDate(opts) {
    debug('ctrl.kwh.handleDate', opts);

    const day = parseInt(opts.date, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      throw new RangeError(
        ':day must be an Integer in the range between 1 and 31. ' +
        'Usage: /power/kwh/:year/:month/:day'
      );
    }

    return this.db.hgetAsync(opts.year, opts.month)
      .then(input => {
        if (input === null) {
          return this.kwhGetFromRangeForDate(opts)
            .then(args => this.kwhTransformDayItem(args))
            .then(args => this.kwhSaveDateInHash(args))
            .then(result => {
              return result;
            });
        }
        return JSON.parse(input);
      })
      .then(result => {
        if (result.hasOwnProperty(opts.date)) return result[opts.date];

        throw new RangeError(
          'Could not find data for given date. It might be outside the data ' +
          'we have stored.'
        );
      })
      .catch(error => {
        throw error;
      });
  }

  /**
   * @param {object} args objects with data and OPTIONS
   * @return {Promise} resolved  promise with data
   * @private
   */
  kwhSaveDateInHash(args) {
    const data = args.data;
    const opts = args.opts;

    debug('ctrl.kwh.saveDateInHash');

    return this.db.hgetAsync(opts.year, opts.month)
      .then(hash => (hash === null) ? {} : JSON.parse(hash))
      .then(hash => {
        debug('    HGET: hash', hash);
        hash[opts.date] = data;
        return hash;
      })
      .then(hash => {
        debug('    HSET data');
        this.db.hset(opts.year, opts.month, JSON.stringify(hash));

        return hash;
      });
  }

  /**
   * @param {object} args input data and options
   * @return {object} transformed data
   * @private
   */
  kwhTransformDayItem(args) {
    const opts = args.opts;
    const data = args.data;

    delete data.total;

    data.perHour = data.perHour.map(function (hour) {
      return parseFloat((hour / 10000).toFixed(4));
    });

    data.description = (
      'kWh usage for date: ' + opts.year + '-' + opts.month + '-' + opts.date
    );

    return {opts: opts, data: data};
  }

  /**
   * @param {object} opts input data
   * @return {Promise} data for the date.
   * @private
   */
  kwhGetFromRangeForDate(opts) {
    return this.db.lrangeAsync('days', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        debug('inside lrange: ', values.length);

        let result = false;
        values.forEach(item => {
          const testDate = new Date(item.timestamp);
          testDate.setDate((testDate.getDate() - 1));
          const month = parseInt(opts.month, 10) - 1;

          if (testDate.getMonth() !== month) return false;
          if (testDate.getDate() !== parseInt(opts.date, 10)) return false;

          result = {data: item, opts: opts};
          return true;
        });

        /* istanbul ignore if */
        if (result === false) {
          throw new RangeError(
            'Date was not found in database. It might be outside the time ' +
            'we have data for.'
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
      .then(reply => {
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
      throw new Error(
        'ctrl.normalizeDate: parameter level not set to one of the ' +
        'default values'
      );
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
