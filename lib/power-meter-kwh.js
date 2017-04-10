
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
const util  = require('../lib/power-meter-util');

class PowerMeterKwh {
  assertYear(year) {
    if (!util.isValidYear(year)) {
      throw new TypeError(
        'Usage: /power/kwh/date/:year. ' +
        'Year must be a valid four digit year.'
      );
    }

    if (!util.isYearInRange(year)) {
      throw new RangeError(
        'Usage: /power/kwh/date/:year. Year must be a year ' +
        `between ${util.config.start.year} and this year.`
      );
    }

    return true;
  }

  assertMonth(year, month) {
    const test  = parseInt(month, 10);
    const tyear = parseInt(year, 10);
    const today = new Date();

    if (isNaN(test) || test < 1 || test > 12) {
      throw new TypeError(
        'Usage: /power/kwh/:year/:month - ' +
        ':month must be a valid month between 01 and 12'
      );
    }

    if (tyear >= today.getFullYear() && month > (today.getMonth() + 1)) {
      throw new TypeError(
        ':month is in the future. Please provide a date in the past.'
      );
    }

    return true;
  }

  assertDay(input) {
    const day = parseInt(input, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      throw new RangeError(
        ':day must be an Integer in the range between 1 and 31. ' +
        'Usage: /power/kwh/:year/:month/:day'
      );
    }

    return true;
  }

  handleDateMonth(req, res, redis) {
    const opts = req.params;

    this.assertYear(opts.year);
    this.assertMonth(opts.year, opts.month);

    return redis.lrangeAsync('months', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        const month = parseInt(opts.month, 10);
        const year  = parseInt(opts.year, 10);

        return values.find(item => {
          const date = new Date(item.timestamp);
          return (date.getFullYear() === year && (date.getMonth()) === month);
        });
      })
      .then(data => {
        if (typeof data === 'undefined') {
          throw new RangeError(
            'Did not find data for the specified month. ' +
            'This might be outside the period we have data for'
          );
        }
        data.perDay = util.pulsesToKwh(data.perDay);

        return data;
      });
  }

  handleDay(req, res, redis) {
    const opts = req.params;

    this.assertYear(opts.year);
    this.assertMonth(opts.year, opts.month);
    this.assertDay(opts.day);

    return redis.hgetAsync(req.params.year, req.params.month)
      .then(input => {
        if (typeof input === 'string') return JSON.parse(input);

        return this.findDateInDays(opts, redis)
          .then(data => {
            delete data.total;
            data.perHour = util.pulsesToKwh(data.perHour);
            data.description = (
              `kWh usage for ${(new Date(data.timestamp)).toDateString()}`
            );
            return data;
          })
          .then(data => this.saveDateInHash(data, opts, redis));
      })
      .then(result => {
        if (result.hasOwnProperty(opts.day)) return result[opts.day];

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
   * @param {object} opts input data
   * @return {Promise} data for the date.
   * @private
   */
  findDateInDays(opts, db) {
    return db.lrangeAsync('days', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => values.find(item => {
        const date  = util.timestampToDate(item.timestamp);
        const month = parseInt(opts.month, 10) - 1;
        const day   = parseInt(opts.day, 10) - 1;

        if (date.getMonth() !== month) return false;
        if (date.getDate()  !== day)   return false;

        return true;
      }));
  }

  /**
   * @param {object} data objects with data and OPTIONS
   * @param {object} opts parameters from URI
   * @param {RedisClient} redis the redis client
   * @return {Promise} resolved  promise with data
   * @private
   */
  saveDateInHash(data, opts, redis) {
    return redis.hgetAsync(opts.year, opts.month)
      .then(hash => (hash === null) ? {} : JSON.parse(hash))
      .then(hash => {
        hash[opts.day] = data;
        return hash;
      })
      .then(hash => {
        redis.hset(opts.year, opts.month, JSON.stringify(hash));
        return hash;
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
   * @param {RedisClient} redis the RedisClient
   * @returns {Promise} a resolved promise with data.
   */
  handleKwh(type, count = 1, redis) {
    const keywords = ['seconds', 'today', 'hour', 'day', 'week', 'month', 'year'];

    if (keywords.indexOf(type) < 0) {
      throw new TypeError(
        'first argument must be a string with one of the keywords: ' +
        keywords.toString()
      );
    }

    switch (type) {
      case 'seconds':
        return this.getKwhSeconds(count, redis);
      case 'today':
        return this.getKwhToday(redis);
      case 'hour':
        return this.getKwhHour(count, redis);
      case 'day':
        return this.getKwhDay(count, redis);
      case 'week':
        return this.getKwhWeek(count, redis);
      default:
        return (count === 'this')
          ? this.getCurrentMonth(redis)
          : this.getKwhMonth(count, redis);
    }
  }

  /**
   * Returns the kwh consumption for today
   *
   * @return {Promise} resolved promise with json
   */
  getKwhToday(db) {
    const now   = new Date();
    const start = this.normalizeDate((new Date()), 'day');
    const diff  = now.getTime() - start.getTime();
    const range = Math.round(diff / (60000));

    return this.getRangeFromEnd(range, 'minutes', db)
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

  /**
   * Adding a controller to fetch out seconds for graphs.
   * Interval is now defined to be 10 seconds.
   *
   * @param {integer} count number of seconds to fetch.
   * @return {Promise} resolved promise with json
   */
  getKwhSeconds(count, db) {
    return this.getSecondsRangeFromEnd(count, db)
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
        summary.watts.average = parseInt((summary.watts.total / values.length), 10);
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
        data.values = data.values.map(item => {
          item.watt = parseInt(item.watt, 10);
          return item;
        });

        return data;
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
  getKwhHour(count = 1, db) {
    return this.getRangeFromEnd(count, 'hours', db)
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
  getKwhDay(count = 1, db) {
    return this.getRangeFromEnd(count, 'days', db)
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
   * @private
   */
  getKwhWeek(count = 1, db) {
    return this.getRangeFromEnd(count, 'weeks', db)
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
   * @private
   */
  getKwhMonth(count, db) {
    return this.getRangeFromEnd(count, 'months', db)
      .then(values => values.map(item => {
        item.perDay = util.pulsesToKwh(item.perDay);
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
  /**
   * @return {Promise} data for current month
   * @private
   */
  getCurrentMonth(db) {
    const date = new Date();
    const days = date.getDate();

    return this.getRangeFromEnd(days - 2, 'days', db)
      .then(values => values.reduce((a, b) => (a + b.kwh), 0))
      .then(kwh => (this.getKwhToday(db).then(today => kwh + today.kwh)))
      .then(kwh => parseFloat(kwh.toFixed(4)))
      .then(kwh => {
        return {
          description: (
            'kWh used so far this month, ' +
            util.monthName(date.getMonth()) + ' ' + date.getFullYear()
          ),
          version: this.version,
          date: date.toJSON(),
          kwh: kwh
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

  /**
   * @param {integer} count number of items to fetch
   * @param {integer} list which list to fetch from
   * @param {RedisClient} db the redisclient
   * @return {Promise} json of items from that list.
   * @private
   */
  getRangeFromEnd(count = 1, list = 'hours', db) {
    return db.lrangeAsync(list, count * -1, -1).then(v => v.map(JSON.parse));
  }

  /**
   * Helper function to bootstrap fetching a range of seconds from the end
   * of the list. Assumes the backend stores data in 10 seconds increment
   * (it does).
   *
   * @param {integer} count the length of the range in seconds
   * @param {RedisClient} db the redisclient
   * @return {Promise} a resolved promise with parsed JSON
   */
  getSecondsRangeFromEnd(count = 1, db) {
    return this.getRangeFromEnd(Math.ceil(count / 10), 'seconds', db);
  }

  /**
   * @param {object} values to return
   * @return {object} the formatted json to return
   * @private
   */
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
      item[prop] = util.pulsesToKwh(item[prop]);
      return item;
    });
  }
}

module.exports = PowerMeterKwh;
