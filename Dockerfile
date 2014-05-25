FROM ubuntu:latest

RUN apt-get install -y nodejs
RUN apt-get install -y npm git git-extras

RUN ln -s /usr/bin/nodejs /usr/bin/node

ADD . /src
RUN cd /src; npm install

EXPOSE 3001
CMD ["/usr/bin/node", "/src/app.js"]

