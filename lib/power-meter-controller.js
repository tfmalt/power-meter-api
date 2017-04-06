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

class PowerMeterController {
  /**
   * Updates the meter total reading in the database.
   *
   * @param {float} value to set meter to
   * @returns {Promise} the resolved promise
   */
  putMeterTotal(value, db) {
    debug('starting ctrl.meter.total.put: ', value);
    if (typeof value !== 'number' || isNaN(value)) {
      throw new TypeError(
        `Value (${value}) passed as argument must be a valid Integer or Float.`
      );
    }

    return db.getAsync('meterTotal')
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
        return db.setAsync('meterTotal', data.newValue)
          .then( result => {
            debug('Updated meterTotal: ', result);
            data.result = result;

            return data;
          });
      })
      .then(data => {
        return db.rpushAsync('meterUpdates', JSON.stringify(data))
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
  getMeterTotal(db) {
    return db.getAsync('meterTotal')
      .then(reply => parseFloat(parseFloat(reply).toFixed(4)))
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
