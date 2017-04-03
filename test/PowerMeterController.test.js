
const chai = require('chai');
// const version = require('../package').version;
const expect = chai.expect;
const PowerMC = require('../lib/power-meter-controller');

const pmc = new PowerMC();

describe('power-meter-controller unit-tests', () => {
  it('should be an instance of PowerMeterController', () => {
    expect(pmc).to.be.instanceof(PowerMC);
  });

  it('handleKwh should throw error when called with invalid data', () => {
    expect(pmc.handleKwh.bind(pmc, 'tullball')).to.throw(TypeError, /first argument must be/);
  });

  it('normalizeDate should throw error on wrong input', () => {
    expect(pmc.normalizeDate.bind(pmc, new Date(), 'tullball'))
      .to.throw(Error, /parameter level not set/);
  });

  it('normalizeDate should return date when level is hour', () => {
    expect(pmc.normalizeDate(new Date(), 'hour')).to.be.instanceof(Date);
  });

  it('normalizeDate should return date when level is week', () => {
    expect(pmc.normalizeDate(new Date(), 'week')).to.be.instanceof(Date);
  });
});
