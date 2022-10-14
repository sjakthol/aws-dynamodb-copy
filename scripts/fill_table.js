'use strict'

const ddb = require('../lib/ddb')

const args = require('yargs')
  .option('target-table', {
    alias: 't',
    desc: 'The target table to write items to',
    required: true
  })
  .option('rate', {
    alias: 'r',
    desc: 'Number of items to copy per second',
    required: true
  })
  .option('num-items', {
    alias: 'n',
    desc: 'Number of items to generate',
    required: true
  })
  .option('partition-key', {
    alias: 'p',
    desc: 'The name of the partition key attribute of the given table',
    required: true
  }).argv

async function main () {
  await ddb.fillTable(args.targetTable, parseInt(args.numItems), parseInt(args.rate), args.partitionKey)
}

main().then(res => console.log('Done'), err => console.error(err, 'Done'))
