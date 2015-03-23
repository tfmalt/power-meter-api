[![Build Status](https://travis-ci.org/tfmalt/power-meter-api.svg?branch=master)](https://travis-ci.org/tfmalt/power-meter-api)
[![Code Climate](https://codeclimate.com/github/tfmalt/power-meter-api/badges/gpa.svg)](https://codeclimate.com/github/tfmalt/power-meter-api)
[![Test Coverage](https://codeclimate.com/github/tfmalt/power-meter-api/badges/coverage.svg)](https://codeclimate.com/github/tfmalt/power-meter-api)

## power meter api

This is a simple api backend for a power meter reader I've build, reading blinking led of my power meter using a photoresistor and an Arduino Uno. The backend is written in node.js using express.js talking to a redis database.

See:
* [power-meter-ionic](https://github.com/tfmalt/power-meter-ionic) for information about the ionic mobile app dashboard.
* [power-meter-monitor](https://github.com/tfmalt/power-meter-monitor) For information about the Arduino Uno project and the node.js backend communicating with the arduino and storing the data in the redis database.

## Iteration 1: Build the circuit

* Build a cirucit with a photoresistor using arduino.
* Verify I get a predictable digital (HIGH|LOW) pulse measuring a red led.
  Yes.
* Verify the arduino uno loop is fast enough to measure my power meter.
  YES. Appox 90000 iterations per second.

## Iteration 2: Write the arduino program

* Write short ardinuo program to 

## Iteration 3: Start the node.js program interfacing the serialport

## Iteration 4: Create a webapp for the service

## Iteration 5: Install Varnish in front of the web app.

## Iteration 6: Move webapp to angular.js and add form to update actual power meter reading.

## Iteration 7: Migrate events to websocket.


## MIT LICENSE
 
Copyright (C) 2013 Thomas Malt <thomas@malt.no>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
copies of the Software, and to permit persons to whom the Software is 
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in 
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE. 
