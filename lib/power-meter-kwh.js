
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
    this.assertYear(req.params.year);
    this.assertMonth(req.params.year, req.params.month);

    redis.lrangeAsync('months', 0, -1)
      .then(values => values.map(JSON.parse))
      .then(values => {
        const month = parseInt(res.params.month, 10) - 1;
        const year  = parseInt(res.params.year, 10);

        return values.find(item => {
          const date = new Date(item.timestamp);
          return (date.getFullYear() === year && (date.getMonth() - 1) === month);
        });
      })
      .then(data => {
        if (typeof data === 'undefined') {
          throw new Error(
            'Did not find data for the specified month. ' +
            'This might be outside the period we have data for'
          );
        }

        delete data.total;

        data.perDay = util.pulsesToKwh(data.perDay);

        return data;
      });
  }

  handleDay(req, res) {
    this.assertYear(req.params.year);
    this.assertMonth(req.params.month);
    this.assertDay(req.params.day);

    redis.hgetAsync(req.params.year, req.params.month)
      .then(input => {
        if (typeof input === 'string') return JSON.parse(input);

        return this.findDateInDays(req.params)
          .then(data => {
            /* istanbul ignore if */
            if (typeof data === 'undefined') {
              throw new RangeError(
                'Date was not found in database. It might be outside the time ' +
                'we have data for.'
              );
            }
            return data;
          })
          .then(data => {
            delete data.total;
            data.perHour = util.pulsesToKwh(data.perHour);
            data.description = (
              `kWh usage for ${(new Date(data.timestamp)).toDateString()}`
            );
            return data;
          })
          .then(data => this.saveDateInHash(data, req.params));
      })
      .then(result => {
        if (result.hasOwnProperty(req.params.day)) return result[req.params.day];

        throw new RangeError(
          'Could not find data for given date. It might be outside the data ' +
          'we have stored.'
        );
      })
      .then(data => {
        res.setHeader('Cache-Control', 'public, max-age=864000');
        res.json(data);
      });
  }

  /**
   * @param {object} opts input data
   * @return {Promise} data for the date.
   * @private
   */
  findDateInDays(opts) {
    return this.db.lrangeAsync('days', 0, -1)
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
   * @return {Promise} resolved  promise with data
   * @private
   */
  saveDateInHash(data, opts) {
    return redis.hgetAsync(opts.year, opts.month)
      .then(hash => (hash === null) ? {} : JSON.parse(hash))
      .then(hash => {
        hash[opts.day] = data;
        return hash;
      })
      .then(hash => {
        this.db.hset(opts.year, opts.month, JSON.stringify(hash));
        return hash;
      });
  }

  /**
   * @param {object} args input data and options
   * @return {object} transformed data
   * @private
   */
  transformDayItem(data, opts) {
  }

}

module.exports = PowerMeterKwh;
