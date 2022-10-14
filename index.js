'use strict'

const hi = require('highland')
const ddb = require('./lib/ddb')
const utils = require('./lib/utils')

function run () {
  const args = require('yargs')
    .option('source-table', {
      alias: 's',
      desc: 'The source table to copy from',
      required: true
    })
    .option('target-table', {
      alias: 't',
      desc: 'The target table to copy to',
      required: true
    })
    .option('rate', {
      alias: 'r',
      desc: 'Number of items to copy per second',
      required: true
    })
    .option('parallelism', {
      alias: 'p',
      desc: 'Number of segments for DynamoDB parallel scan',
      default: 20
    }).argv

  const RATE_LIMIT = parseInt(args.rate)
  const SCAN_SEGMENTS = parseInt(args.parallelism)
  const SOURCE_TABLE = args.sourceTable
  const TARGET_TABLE = args.targetTable

  const generators = []
  for (let i = 0; i < SCAN_SEGMENTS; ++i) {
    generators.push(hi(ddb.createScanner({
      Segment: i,
      TableName: SOURCE_TABLE,
      TotalSegments: SCAN_SEGMENTS
    })))
  }
  return hi(generators)
    .merge()
    .through(ddb.createStreamWriter(TARGET_TABLE, RATE_LIMIT))
    .through(utils.createStreamThroughputReporter('output'))
    .collect()
    .toPromise(Promise)
}

/* istanbul ignore next */
if (require.main === module) {
  run().then(res => console.log('Done'), err => console.error(err, 'Done'))
}

module.exports = { run }
