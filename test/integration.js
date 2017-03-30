

const chai = require('chai');
const http = require('chai-http');
const app  = require('../server').app;
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
