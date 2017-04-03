
FROM node:boron-alpine
MAINTAINER thomas@malt.no

RUN mkdir -p /usr/lib/power/api
WORKDIR /usr/lib/power/api

COPY . /usr/lib/power/api
RUN npm install

ENV NODE_ENV=docker
ENV DEBUG=power-meter:*

CMD node ./server.js
