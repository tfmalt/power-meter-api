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

const key = process.env.POWER_API_KEY;
const secret = process.env.POWER_API_SECRET;

args.options([
  {
    name: 'uri',
    description: 'The base uri to use for requests.',
    defaultValue: 'http://localhost:3000'
  },
  {
    name: 'key',
    description: 'API key to access the API',
    defaultValue: null
  }
]);

args.command('usage', 'Current electricity usage.', (name, sub, options) => {
  const url = options.uri + '/power/kwh/seconds/3600';
  fetch(url)
    .then(res => res.json())
    .then(json => {
      console.log(chalk.dim('                max  avg  min'));
      console.log(
        'Load last hour:',
        chalk.cyan(json.summary.watts.max),
        chalk.cyan.underline(json.summary.watts.average),
        chalk.cyan(json.summary.watts.min),
        'Watt.'
      );
      console.log(
        'Total usage last hour:',
        chalk.cyan(json.summary.kwh.total),
        'kWh.');
    });

  fetch(options.uri + '/power/watts')
    .then(res => res.json())
    .then(json => {
      console.log('Right now the load is', chalk.cyan(json.watt), 'Watt.');
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
