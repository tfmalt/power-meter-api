

const chai = require('chai');
const http = require('chai-http');
const app  = require('../server').app;
const version = require('../package').version;
const expect = chai.expect;

chai.use(http);

describe('Get a correct response from server', () => {
  it('should give correct status code', (done) => {
    chai.request(app).get('/').end((err, res) => {
      expect(err).to.be.an.object;
      expect(res).to.have.status(404);
      done();
    });
  });
});

describe('power health is working', () => {
  it('should return correct health json', (done) => {
    chai.request(app).get('/power/health').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.not.have.header('x-powered-by');
      expect(res.body).to.contain.keys(['cpu', 'mem', 'tick', 'healthy']);
      done();
    });
  });
});

describe('power API', () => {
  it('should return correct version information', (done) => {
    chai.request(app).get('/power/').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.deep.equal({
        message: 'Service is running properly',
        version: 'v' + version
      });
      done();
    });
  });
});

describe('/power/watts', () => {
  it('should return correct watts for default interval', (done) => {
    chai.request(app).get('/power/watts').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.header('Cache-Control', 'public, max-age=5');
      expect(res.body).to.have.keys(
        ['description', 'version', 'interval', 'watt', 'max', 'min', 'time']
      );
      done();
    });
  });

  it('should return correct watts for 20s interval', (done) => {
    chai.request(app).get('/power/watts/20').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.header('Cache-Control', 'public, max-age=5');
      expect(res.body).to.have.keys(
        ['description', 'version', 'interval', 'watt', 'max', 'min', 'time']
      );
      done();
    });
  });

  it('should return correct watts for hour interval', (done) => {
    chai.request(app).get('/power/watts/hour').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.header('Cache-Control', 'public, max-age=30');
      expect(res.body).to.have.keys(['description', 'version', 'container', 'items']);
      expect(res.body.items.length).to.equal(60);
      expect(res.body.items[0]).to.contain.keys(
        ['time', 'watt', 'perSecond']
      );
      expect(res.body.items[0].perSecond.length).to.equal(6);
      done();
    });
  });
});

describe('/kwh/date/:year?/:month?/:date?', () => {
  it('should return valid json for a valid date', (done) => {
    chai.request(app).get('/power/kwh/date/2017/03/30').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys({kwh: 77.3696, pulses: 773696});
      expect(res.body).to.contain.keys(['perHour', 'description', 'time']);
      expect(res.body.perHour.length).to.equal(24);
      done();
    });
  });

  it('should return proper error code for a year in the future', (done) => {
    const year = (new Date()).getFullYear() + 1;

    chai.request(app).get(`/power/kwh/date/${year}/03/30`).end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(400);
      expect(res.body.message).to.match(/Year must be between/);
      done();
    });
  });

  it('should return proper error code for a month in the future', (done) => {
    const date  = new Date();
    const year  = date.getFullYear();
    const month = '0' + (date.getMonth() + 3);

    chai.request(app).get(`/power/kwh/date/${year}/${month}/10`).end((err, res) => {
      // console.log(res.status);
      // console.log(res.body);
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(400);
      expect(res.body.message).to.match(/Date is in the future/);
      done();
    });
  });

  it('should return valid json for a valid month', (done) => {
    chai.request(app).get('/power/kwh/date/2017/03').end((err, res) => {
      console.log(res.status);
      console.log(res.body);
      //  expect(err).to.be.null;
      expect(res).to.be.json;
      done();
    });
  });

});
