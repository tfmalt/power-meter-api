

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
      console.log(res.body);
      done();
    });
  });
});
