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
    .option('source-table-region', {
      desc: 'AWS region that hosts the source table',
      default: null,
      defaultDescription: 'Current region'
    })
    .option('target-table', {
      alias: 't',
      desc: 'The target table to copy to',
      required: true
    })
    .option('target-table-region', {
      desc: 'AWS region that hosts the tager table',
      default: null,
      defaultDescription: 'Current region'
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

  const rate = parseInt(args.rate)
  const parallelism = parseInt(args.parallelism)
  const sourceTable = args.sourceTable
  const sourceTableRegion = args.sourceTableRegion || undefined
  const targetTable = args.targetTable
  const targetTableRegion = args.targetTableRegion || undefined

  const generators = []
  for (let i = 0; i < parallelism; ++i) {
    generators.push(hi(ddb.createScanner({
      Segment: i,
      TableName: sourceTable,
      TotalSegments: parallelism
    }, { region: sourceTableRegion })))
  }
  return hi(generators)
    .merge()
    .through(ddb.createStreamWriter(targetTable, rate, { region: targetTableRegion }))
    .through(utils.createStreamThroughputReporter('output'))
    .collect()
    .toPromise(Promise)
}

/* istanbul ignore next */
if (require.main === module) {
  run().then(res => console.log('Done'), err => console.error(err, 'Done'))
}

module.exports = { run }
