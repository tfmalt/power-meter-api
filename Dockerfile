FROM ubuntu:latest

RUN apt-get install -y nodejs
RUN apt-get install -y npm git git-extras

RUN ln -s /usr/bin/nodejs /usr/bin/node

ADD . /src

RUN rm /src/config.js
RUN cp /src/config-aws.js /src/config.js
RUN cd /src; npm install

ENV TZ Europe/Oslo

EXPOSE 3001
CMD ["/usr/bin/node", "/src/app.js"]
