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
        const total = values.reduce((a, b) => (a + b.kwh), 0);
        const max = values.reduce((a, b) => ((a > b.kwh) ? a : b.kwh), 0);
        const min = values.reduce((a, b) => ((a < b.kwh) ? a : b.kwh), 2147483648);
        const average = total / values.length;

        return {
          description: 'kWh consumption per hour for ' + count + ' hours',
          total: parseFloat(total.toFixed(4)),
          max: max,
          min: min,
          average: parseFloat(average.toFixed(4)),
          count: count,
          list: values
        };
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
    this.db.lrangeAsync('months', (count * -1), -1)
      .then(values => values.map(JSON.parse))
      .then(values => values.map(item => {
        if (!(item.hasOwnProperty('perDay')) && item.hasOwnProperty('perMinute')) {
          item.perDay = item.perMinute;
          delete item.perMinute;
        }

        item.perDay = item.perDay.map(day => parseFloat((day / 10000).toFixed(4)));
        return item;
      }))
      .then(values => {
        const min = values.reduce((a, b) => (a < b.kwh ? a : b.kwh), Number.MAX_VALUE);
        const max = values.reduce((a, b) => (a > b.kwh ? a : b.kwh), 0);
        const sum = values.reduce((a, b) => (a + b.kwh), 0);
        const avg = sum / values.length;

        return {
          description: 'kWh consumption per month for ' + count + ' months',
          total: parseFloat(sum.toFixed(4)),
          average: parseFloat(avg.toFixed(4)),
          count: count,
          max: max,
          min: min,
        list: values
      };
    });

  }

  getCalculatedKwhSummary(values) {
    var summary = {
      total: 0,
      max: null,
      min: null,
      average: 0,
      list: values
    };

    values.forEach(function(item) {
      if (summary.max === null || summary.max < item.kwh) {
        summary.max = item.kwh;
      }
      if (summary.min === null || summary.min > item.kwh) {
        summary.min = item.kwh;
      }
      summary.total += item.kwh;
    });

    summary.average = summary.total / values.length;

    return summary;
  }

  transformCountToKwh(values, property) {
    return values.map(function(item) {
      item[property] = item[property].map(function(value) {
        return parseFloat((value / 10000).toFixed(4));
      });
      return item;
    });
  }

  getKwhTransformPerMinute(items, toProperty) {
    return items.map(function(item) {
      if (!(item.hasOwnProperty(toProperty)) && item.hasOwnProperty("perMinute")) {
        item[toProperty] = item.perMinute;
        delete item.perMinute;
      }
      return item;
    });
  }

  getKwhByDate(opts) {
    console.log("ctr.kwh.byDate: ", opts);

    if (opts.year === undefined) {
      throw new TypeError("Usage: /power/kwh/:year/:month/:date " +
        "URI must be called with at least :year as argument. ");
    }

    return ctrl.kwh.handleYear(opts).catch(function(error) {
      console.log("got error:", error.name, error.message);
      return {error: error.name, message: error.message};
    });
  };

  kwhHandleYear(opts) {
    console.log("ctrl.kwh.handleYear");
    var now = new Date();

    if (opts.year < 2015 || opts.year > now.getFullYear()) {
      throw new RangeError("Usage: /power/kwh/:year/:month/:date " +
        "Year must be between 2015 and " + now.getFullYear());
    }

    if (typeof opts.month !== 'undefined') {
      return ctrl.kwh.handleMonth(opts);
    } else {
      return Q.ninvoke(ctrl.read, "HEXISTS", "2016", "data").then(function(result) {
        console.log("handle year result:", result);
        return {'result': result};
      });
    }
  };

  kwhHandleMonth(opts) {
    console.log("ctrl.kwh.handleMonth");
    var month = parseInt(opts.month);
    if (isNaN(month) || month < 1 || month > 12) {
      throw new RangeError("Usage: /power/kwh/:year/:month/:date " +
        ":month must be an integer between 01 and 12");
    }

    if (opts.date !== undefined) {
      return ctrl.kwh.handleDate(opts);
    }

    return ctrl.kwh.getMonthData(opts);
  };

  getKwhMonthData(opts) {
    return Q.ninvoke(ctrl.read, "LRANGE", "months", 0, -1).then(function(values) {
      console.log("  Fetching month from range: length:", values.length);
      var testMonth = parseInt(opts.month) - 1;
      for (var i = 0; i < values.length; i++) {
        var item = JSON.parse(values[i]);
        var itemDate = new Date(item.timestamp);

        itemDate.setMonth(itemDate.getMonth() - 1);

        var itemMonth = itemDate.getMonth();
        var itemYear = itemDate.getFullYear();

        if (itemYear == opts.year && itemMonth === testMonth) {
          console.log("    Found match: ", itemMonth, testMonth);
          return item;
        }
      }
    }).then(function(data) {
      if (data === undefined) {
        throw new Error("Did not find any data stored for that Month. " +
          "Might be outside range of what is stored.");
      }

      return data;
    }).then(function(data) {
      console.log("    Got data. Cleaning up");

      delete data.total;

      if (!(data.hasOwnProperty("perDay")) && data.hasOwnProperty("perMinute")) {
        data.perDay = data.perMinute;
        delete data.perMinute;
      }

      data.perDay = data.perDay.map(function(day) {
        return parseFloat((day / 10000).toFixed(4));
      });

      var date = new Date(data.timestamp);
      date.setMonth(date.getMonth() - 1);

      var month = date.getMonth();
      var year = date.getFullYear();

      data.description = ("kWh usage for " + ctrl.monthName[month] + ", " + year);

      return data;
    });
  };

  kwhHandleDate(opts) {
    console.log("ctrl.kwh.handleDate", opts);

    var day = parseInt(opts.date);
    var month = parseInt(opts.month);

    if (isNaN(day) || day < 1 || day > 31) {
      throw new RangeError(":day must be an Integer in the range between 1 and 31. " +
        "Usage: /power/kwh/:year/:month/:day");
    }

    if (month < 10) {
      month = "0" + month;
    }

    if (day < 10) {
      day = "0" + day;
    }

    return Q.ninvoke(ctrl.read, "HGET", opts.year, month).then(function(result) {
      if (result === null) {
        console.log("  hash is null. getting from range.");
        return ctrl.kwh.getFromRangeForDate(opts).then(ctrl.kwh.transformDayItem).then(ctrl.kwh.saveDateInHash);
      }

      result = JSON.parse(result);
      if (result[day] === undefined) {
        console.log("  hash exists, but not for correct date");
        return ctrl.kwh.getFromRangeForDate(opts).then(ctrl.kwh.transformDayItem).then(ctrl.kwh.saveDateInHash);
      }

      console.log("  has exists. correct day exists");
      return result[day];
    });
  };

  kwhSaveDateInHash(args) {
    var data = args.data;
    var opts = args.opts;

    console.log("ctrl.kwh.saveDateInHash");

    Q.ninvoke(ctrl.read, "HGET", opts.year, opts.month).then(function(hash) {
      if (hash === null) {
        console.log("    HGET: null");
        hash = {};
      } else {
        console.log("    HGET: hash");
        hash = JSON.parse(hash);
      }
      hash[opts.date] = data;
      return hash;
    }).then(function(hash) {
      console.log("    HSET data");
      Q.ninvoke(ctrl.write, "HSET", opts.year, opts.month, JSON.stringify(hash)).done();
    });

    return data;
  };

  kwhGetFromHashForDate(opts) {
    return Q.ninvoke(ctrl.read, "HGET", opts.year, opts.month).then(function(data) {
      data = JSON.parse(data);
      return data[opts.date];
    });
  };

  kwhTransformDayItem(args) {
    var opts = args.opts;
    var data = args.data;

    delete data.total;

    if (!(data.hasOwnProperty("perHour")) && data.hasOwnProperty("perMinute")) {
      data.perHour = data.perMinute;
      delete data.perMinute;
    }

    data.perHour = data.perHour.map(function(hour) {
      return parseFloat((hour / 10000).toFixed(4));
    });

    data.description = "kWh usage for date: " + opts.year + "-" + opts.month + "-" + opts.date;

    return {opts: opts, data: data};
  };

  kwhGetFromRangeForDate(opts) {
    return Q.ninvoke(ctrl.read, "LRANGE", "days", 0, -1).then(function(values) {
      console.log("  inside lrange: ", values.length);
      for (var i = 0; i < values.length; i++) {
        var item = JSON.parse(values[i]);
        var testDate = new Date(item.timestamp);
        testDate.setDate((testDate.getDate() - 1));

        if (parseInt(testDate.getMonth()) !== parseInt(opts.month) - 1) {
          continue;
        }
        if (parseInt(testDate.getDate()) !== parseInt(opts.date)) {
          continue;
        }

        return {data: item, opts: opts};
      }

      throw new RangeError("Date was not found in database. Are you sure the day is correct?");
    });
  };

  /**
   * Updates the meter total reading in the database.
   *
   * @param value
   * @returns {Promise}
   */
  putMeterTotal(value) {
    console.log("starting ctrl.meter.total.put: ", value);
    // return data;

    return Q.ninvoke(ctrl.write, 'get', 'meterTotal').then(function(total) {
      var data = {
        "timestamp": (new Date()).toJSON(),
        "newValue": parseFloat(value),
        "oldValue": parseFloat(total)
      };
      console.log("  current: ", total);
      console.log("      new: ", value);

      if (isNaN(data.newValue)) {
        throw new TypeError("The value used must be a valid integer from the power meter");
      }

      data.delta = parseFloat((data.newValue - data.oldValue).toFixed(4));

      return data;
    }).then(function(data) {
      return Q.ninvoke(ctrl.write, 'set', 'meterTotal', data.newValue).then(function(result) {
        console.log("Updated meterTotal: ", result);
        data.result = result;

        return data;
      });
    }).then(function(data) {
      return Q.ninvoke(ctrl.write, 'rpush', 'meterUpdates', JSON.stringify(data)).then(function(result) {
        console.log("Added to meterUpdates:", result);
        data.meterUpdates = result;
        data.description = "Updated meterTotal and updated statistics.";
        return data;
      });
    });
  };

  /**
   * Reads the meterTotal from the database and returns the json.
   *
   * @returns {Promise}
   */
  getMeterTotal() {
    return Q.ninvoke(ctrl.read, "get", "meterTotal").then(function(reply) {
      console.log("ctrl.meter.total.get: ", reply);
      var data = {};
      var date = new Date();

      data.description = "Current Power meter total registered on server";
      data.version = ctrl.version;
      data.timestamp = date.getTime();
      data.time = date.toJSON();
      data.total = parseFloat(reply);

      return data;
    });
  };

  /**
   * Returns current usage in watts over a period in time:
   * GET /power/usage?duration=3600&interval=60
   *
   * @param duration
   * @param interval
   * @returns {*}
   */
  getUsage(duration, interval) {
    return Q.ninvoke(ctrl.read, 'lrange', 'seconds', (duration * -1), -1).then(function(values) {
      console.log("got values: ", values.length);
      return values.map(function(item) {
        return JSON.parse(item);
      });
    }).then(function(values) {
      var result = [];
      var max = null;
      var min = null;
      var tot = 0;

      for (var i = 0; i < values.length; i++) {
        if (max === null || values[i].watt > max) {
          max = values[i].watt;
        }

        if (min === null || values[i].watt < min) {
          min = values[i].watt;
        }
        tot += values[i].watt;

        if (i > 0 && i % interval === 0) {
          result.push({
            max: max,
            min: min,
            avg: tot / interval
          });

          tot = 0;
          max = null;
          min = null;
        }
      }

      result.push({
        max: max,
        min: min,
        avg: tot / interval
      });

      return {
        description: 'Usage for ' + duration + ' seconds with ' + interval + ' seconds average intervals.',
        values: result
      };
    });

  };

  /**
   * Helper function to set seconds, minutes and hours to 0 on a date used
   * for lookup in the redis database. Actually a result of factoring out
   * 5 lines of code in the kwh.handler function :/.
   *
   * level: 3 = set minutes to 0, 4 = set hours to 0, 5 = set to first day of week.
   *
   * @param date Date the date that is now.
   * @param level String to what level we normalise
   * @returns *
   * @private
   */
  normalizeDate(date, level) {
    level = typeof level === "undefined"
      ? 'millis'
      : level;
    var levels = {
      'hour': 3,
      'day': 4,
      'week': 5
    };

    if (!levels.hasOwnProperty(level)) {
      throw new Error("ctrl.normalizeDate: parameter level not set to one of the default values");
    }

    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(0);

    if (levels[level] < 4) {
      return date;
    }

    date.setHours(0);

    if (levels[level] < 5) {
      return date;
    }
    // Spool date to first day of the week.
    date.setDate((date.getDate() - date.getDay()));

    return date;
  };
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
