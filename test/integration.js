

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

  it('should return error for invalid interval', (done) => {
    chai.request(app).get('/power/watts/tullball').end((err, res) => {
      console.log(res.body);
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

  it('should return error for an invalid date', (done) => {
    chai.request(app).get('/power/kwh/date/2017/03/60').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(400);
      expect(res.body).to.contain.keys(['error', 'message']);
      done();
    });
  });

  it('should return proper error code for a date we dont have', (done) => {
    chai.request(app).get('/power/kwh/date/2017/03/02').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(404);
      expect(res.body).to.contain.keys({error: 'Missing Data'});
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

  it('should return valid json for a empty month', (done) => {
    chai.request(app).get('/power/kwh/date/2017').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      done();
    });
  });

  it('should return valid json for a valid month', (done) => {
    chai.request(app).get('/power/kwh/date/2017/03').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['perDay', 'kwh', 'description', 'time']);
      done();
    });
  });

  it('should return error for a month we dont have', (done) => {
    chai.request(app).get('/power/kwh/date/2017/01').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(404);
      expect(res.body).to.contain.keys(['error', 'message']);
      done();
    });
  });

  it('should return error for an invalid month', (done) => {
    chai.request(app).get('/power/kwh/date/2017/17').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['error', 'message']);
      done();
    });
  });

  it('should return error for undefined year /power/kwh/date', (done) => {
    chai.request(app).get('/power/kwh/date/').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(400);
      done();
    });
  });
});

describe('/kwh/:type/:count?', () => {
  it('should return error with incorrect URI', (done) => {
    chai.request(app).get('/power/kwh/notsupported').end((err, res) => {
      expect(err).to.be.object;
      expect(res).to.be.json;
      expect(res).to.have.status(400);
      done();
    });
  });

  it('should return valid json for /kwh/seconds', (done) => {
    chai.request(app).get('/power/kwh/seconds').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['summary', 'list', 'description', 'time']);
      expect(res.body.list.length).to.equal(1);
      done();
    });
  });

  it('should return valid json for /kwh/seconds/30', (done) => {
    chai.request(app).get('/power/kwh/seconds/30').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['summary', 'list', 'description', 'time']);
      expect(res.body.list.length).to.equal(3);
      done();
    });
  });

  it('should return valid json for /kwh/seconds/3600', (done) => {
    chai.request(app).get('/power/kwh/seconds/3600').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['summary', 'list', 'description', 'time']);
      expect(res.body.list.length).to.equal(360);
      done();
    });
  });

  it('should return valid json for /kwh/today', (done) => {
    chai.request(app).get('/power/kwh/today').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res.body).to.contain.keys(['description', 'date', 'kwh']);
      done();
    });
  });

  it('should return valid json for /kwh/hour/6', (done) => {
    chai.request(app).get('/power/kwh/hour/6').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.count).to.equal(6);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/hour/1000', (done) => {
    chai.request(app).get('/power/kwh/hour/1000').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/day/2', (done) => {
    chai.request(app).get('/power/kwh/day/2').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.count).to.equal(2);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/day/100', (done) => {
    chai.request(app).get('/power/kwh/day/100').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/week/1000', (done) => {
    chai.request(app).get('/power/kwh/week/1000').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/week', (done) => {
    chai.request(app).get('/power/kwh/week').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/month', (done) => {
    chai.request(app).get('/power/kwh/month').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/month/10', (done) => {
    chai.request(app).get('/power/kwh/month/10').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['count', 'total', 'min', 'max', 'average', 'description']);
      expect(res.body.list.length).to.equal(res.body.count);
      done();
    });
  });

  it('should return valid json for /kwh/month/this', (done) => {
    chai.request(app).get('/power/kwh/month/this').end((err, res) => {
      expect(err).to.be.null;
      expect(res).to.be.json;
      expect(res).to.have.status(200);
      expect(res.body).to.contain.keys(['date', 'kwh', 'description']);
      done();
    });
  });
});
