[![Build Status](https://travis-ci.org/tfmalt/power-meter-api.svg?branch=master)](https://travis-ci.org/tfmalt/power-meter-api)
[![Code Climate](https://codeclimate.com/github/tfmalt/power-meter-api/badges/gpa.svg)](https://codeclimate.com/github/tfmalt/power-meter-api)
[![Test Coverage](https://codeclimate.com/github/tfmalt/power-meter-api/badges/coverage.svg)](https://codeclimate.com/github/tfmalt/power-meter-api)

## power meter api

This is a simple api backend for a power meter reader I've build, reading blinking led of my power meter using a photoresistor and an Arduino Uno. The backend is written in node.js using express.js talking to a redis database.

See:
* [power-meter-ionic](https://github.com/tfmalt/power-meter-ionic) for information about the ionic mobile app dashboard.
* [power-meter-monitor](https://github.com/tfmalt/power-meter-monitor) For information about the Arduino Uno project and the node.js backend communicating with the arduino and storing the data in the redis database.

