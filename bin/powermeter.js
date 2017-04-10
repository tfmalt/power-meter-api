#!/usr/bin/env node
/**
 * A simple command line utility script to test the api.
 * Created by Thomas Malt on 22/02/16.
 */
// const https = require('https');
// const querystring = require('querystring');
const args = require('args');
const fetch = require('node-fetch');
const chalk = require('chalk');

args
  .option('uri', 'The base uri to use for requests.', 'https://api.malt.no')
  .option('apikey', 'API key to access the API', process.env.POWER_APIKEY);

args.command('usage', 'Current electricity usage.', (name, sub, options) => {
  if (typeof options.apikey !== 'string' || options.apikey.length !== 32) {
    console.error(
      'Error: ' + chalk.red('missing argument') + '. ' +
      'Could not find a valid ' + chalk.red('apikey') + '.'
    );
    process.exit(1);
  }
  const url  = options.uri + '/power/kwh/seconds/3600';
  const opts = {
    headers: {
      apikey: options.apikey
    }
  };
  fetch(url, opts)
    .then(res => res.json())
    .then(json => {
      console.log(
        'Load last hour:',
        chalk.dim('max:') + chalk.cyan(json.summary.watts.max) + ', ' +
        chalk.dim('avg:') + chalk.cyan.underline(json.summary.watts.average) + ', ' +
        chalk.dim('min:') + chalk.cyan(json.summary.watts.min) + ' Watt.'
      );
      console.log(
        'Total usage last hour:',
        chalk.cyan(json.summary.kwh.total),
        'kWh.');
    })
    .catch(error => {
      console.log(error.toString());
    });

  fetch(options.uri + '/power/watts', opts)
    .then(res => res.json())
    .then(json => {
      console.log('Load right now:', chalk.cyan(json.watt), 'Watt.');
    })
    .catch(err => {
      console.error('Error:', err.name, err.message);
    });
});

args.parse(process.argv);

// if (typeof token === 'undefined') {
//   console.log('you must provide the api key and secret by setting the\n' +
//     'POWER_API_KEY and POWER_API_SECRET environment variables.');
//   process.exit();
// }
