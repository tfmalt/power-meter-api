#!/usr/bin/env node
/**
 * A simple command line utility script to test the api.
 * Created by Thomas Malt on 22/02/16.
 */

const jwt         = require('json-web-token');
const https       = require('https');
const querystring = require('querystring');
const yargs       = require('yargs');

const key    = process.env.POWER_API_KEY;
const secret = process.env.POWER_API_SECRET;
const token  = jwt.encode(secret, {"iss": key}).value;

if (token === undefined) {
    console.log(
        "you must provide the api key and secret by setting the\n" +
        "POWER_API_KEY and POWER_API_SECRET environment variables."
    );
    process.exit();
}

var options = {
    hostname: 'api.malt.no',
    port: 443,
    path: '/power/test',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer ' + token
    }
};

yargs
    .usage("$0 <cmd> [args]")
    .command(
        'total',
        "Print power meter kWh's total.",
        {
            'set': {
                alias: 's',
                default: 'false'
            },
            'value': {
                alias: 'v',
                type: 'number',
                default: parseInt("hello")
            }
        },
        function (argv) {
            options.path = "/power/meter/total";

            if (argv.set === true) {
                if (isNaN(argv.value)) {
                    console.log(
                        "SyntaxError: When setting the meter a valid value " +
                        "must be provided."
                    );
                    yargs.showHelp();
                    process.exit();
                }

                var qstring = querystring.stringify({"value": argv.value});
                options.method = "PUT";
                options.headers['Content-Length'] = Buffer.byteLength(qstring);
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            var req = https.request(options, function (res) {
                var str = "";
                res.on('data', function (d) {
                    str += d;
                });

                res.on('end', function () {
                    if (argv.set === true) {
                        var data = JSON.parse(str);
                        console.log(data.description);
                        console.log("  old value:", data.oldValue);
                        console.log("  new value:", data.newValue);
                        console.log("      delta:", data.delta.toFixed(4));
                    }
                    else {
                        console.log('Meter total:', str);
                    }
                });
            });

            if (argv.set === true) {
                req.write(qstring);
            }
            req.end();

            req.on('error', function (e) {
                console.error(e);
            });
        }
    )
    .command(
        'watts',
        'Print current power consumption in watts',
        {
            'interval': {
                alias: 'i',
                default: 5,
                type: 'number'
            }
        },
        function (argv) {
            // console.log('watts: ', argv);
            if (isNaN(argv.interval)) {
                console.log("SyntaxError: --interval, -i must be an integer.");
                yargs.showHelp();
                process.exit();
            }

            options.path = "/power/watts/" + argv.interval;

            var req = https.request(options, function (res) {
                var str = "";
                res.on('data', function (d) {
                    str += d;
                });

                res.on('end', function () {
                    var data = JSON.parse(str);
                    console.log(data.description + ":");
                    console.log("   Watts:", data.watt);
                    console.log("     Max:", data.max);
                    console.log("     Min:", data.min);
                    console.log('Interval:', data.interval);
                });
            });
            req.end();

            req.on('error', function (e) {
                console.error(e);
            });
        }
    )
    .help('h')
    .alias('h', 'help')
    .argv;

