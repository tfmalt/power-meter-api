
const chai = require('chai');
// const version = require('../package').version;
const expect = chai.expect;
const PowerMC = require('../lib/power-meter-controller');

const pmc = new PowerMC();

describe('power-meter-controller unit-tests', () => {
  it('should be an instance of PoowerMeterController', () => {
    expect(pmc).to.be.instanceof(PowerMC);
  });

  it('handleKwh should throw error when called with invalid data', () => {
    expect(pmc.handleKwh.bind(pmc, 'tullball')).to.throw(TypeError, /first argument must be/);
  });
});
