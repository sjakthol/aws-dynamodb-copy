'use strict'

const crypto = require('crypto')
const hi = require('highland')
const ddb = require('../lib/ddb')
const utils = require('../lib/utils')

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

const TARGET_TABLE = args.targetTable
const NUM_ITEMS = parseInt(args.numItems)
const RATE_LIMIT = parseInt(args.rate)
const PARTITION_KEY = args.partitionKey

let item = 0
hi(function (push, next) {
  push(null, { [PARTITION_KEY]: { S: (item++).toString() }, value: { S: crypto.randomBytes(8).toString('hex') } })
  if (item >= NUM_ITEMS) push(null, hi.nil)
  else next()
})
  .through(ddb.createStreamWriter(TARGET_TABLE, RATE_LIMIT))
  .through(utils.createStreamThroughputReporter('output'))
  .collect()
  .toCallback(function (err, res) {
    console.log(err, 'Done')
  })
