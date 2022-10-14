'use strict'

const crypto = require('crypto')
const hi = require('highland')
const utils = require('./utils')

const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers')
const { BatchWriteItemCommand, DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb')

/**
 * Writes a batch of items to DynamoDB really hard.
 *
 * @typedef {import('@aws-sdk/client-dynamodb').WriteRequest} WriteRequest
 *
 * @param {Record<string, WriteRequest[]>} batch
 * @param {DynamoDBClient} ddb DynamoDB client to use for writes
 * @returns {Promise<void>}
 */
async function batchWriteItems (batch, ddb) {
  const batchId = crypto.randomBytes(4).toString('hex')
  let attempt = 0
  let unprocessed = batch
  do {
    const cmd = new BatchWriteItemCommand({ RequestItems: unprocessed })
    const res = await ddb.send(cmd)
      .catch(err => {
        if (!err.retryable) throw err
        console.error(
          `WARNING: DynamoDB call failed. batch=${batchId}, attempt=${attempt}, err=${JSON.stringify(err)}`)
        return { UnprocessedItems: unprocessed }
      })

    unprocessed = res.UnprocessedItems

    if (Object.keys(unprocessed).length > 0) {
      const backoff = 100 * 2 ** attempt + Math.round(Math.random() * 100)
      const numUnprocessed = Object.keys(unprocessed).reduce((total, table) => {
        return total + unprocessed[table].length
      }, 0)

      console.error(
        'WARNING: DynamoDB failed to process items. ' +
        `batch=${batchId}, attempt=${attempt}, numUnprocessed=${numUnprocessed}, backoff=${backoff}ms`)

      attempt++
      await new Promise(resolve => setTimeout(resolve, backoff))
    }
  } while (Object.keys(unprocessed).length > 0)
}

/**
 * Create a writer that writes the contents of a stream to a DynamoDB
 * table. The return value should be passed to Stream.through().
 *
 * @param {String} table name of the table to write to
 * @param {Number} ratelimit the number of writes per second to perform
 * @param {object} opts options for the writer
 * @param {string} [opts.region] region of the table to write to
 * @param {string} [opts.role] ARN of a role to assume for the write operations
 * @returns {(x: Highland.Stream) => Highland.Stream}
 */
function createStreamWriter (table, ratelimit, opts = {}) {
  const ddb = new DynamoDBClient({
    region: opts.region || undefined,
    credentials: (opts.role
      ? fromTemporaryCredentials({
        params: { RoleArn: opts.role }
      })
      : undefined)
  })
  return stream =>
    stream
      .through(utils.createContinuousRateLimiter(ratelimit))
      .batch(25)
      .map(hi.wrapCallback(function (batch, callback) {
        const items = batch.map(Item => ({ PutRequest: { Item } }))
        batchWriteItems({
          [table]: items
        }, ddb)
          .then(() => setImmediate(() => callback(null, batch)))
          .catch(callback)
      }))
      .parallel(100)
      .flatten()
}

/**
 * Creates a function that scans the contents of a DynamoDB table and
 * pushes them to a highland stream.
 *
 * @typedef {import('@aws-sdk/client-dynamodb').ScanInput} ScanInput
 *
 * @param {ScanInput} scanInput options to the scan operation
 * @param {object} opts options for DynamoDB client
 * @param {string} [opts.region] region of the table to scan
 * @param {string} [opts.role] ARN of a role to assume for the read operations
 * @return {(push: (err: Error | null, x?: Object | Highland.Nil) => void, next: () => void) => void} a highland generator function
 */
function createScanner (scanInput, opts = {}) {
  const ddb = new DynamoDBClient({
    region: opts.region || undefined,
    credentials: (opts.role
      ? fromTemporaryCredentials({
        params: { RoleArn: opts.role }
      })
      : undefined)
  })
  return function scanner (push, next) {
    const cmd = new ScanCommand(scanInput)
    ddb.send(cmd).then(data => {
      for (const item of data.Items || []) {
        push(null, item)
      }

      scanInput.ExclusiveStartKey = data.LastEvaluatedKey
      if (!data.LastEvaluatedKey) {
        push(null, hi.nil)
        return
      }

      return next()
    }, err => {
      push(err)
      return next()
    })
  }
}

/**
 * Helper function to fill a DynamoDB table with dummy data.
 *
 * Note: Only tables with non-composite primary key are supported.
 *
 * @param {string} table table to fill
 * @param {number} numItems number of items to write
 * @param {number} rate records per second
 * @param {string} partitionKey name of partition key attribute
 * @returns Promise that resolves when all data has been written to DynamoDB
 */
async function fillTable (table, numItems, rate, partitionKey) {
  let item = 0
  return hi(function (push, next) {
    push(null, { [partitionKey]: { S: (item++).toString() }, value: { S: crypto.randomBytes(8).toString('hex') } })
    if (item >= numItems) push(null, hi.nil)
    else next()
  })
    .through(createStreamWriter(table, rate))
    .through(utils.createStreamThroughputReporter('output'))
    .collect()
    .toPromise(Promise)
}

module.exports = { batchWriteItems, createScanner, createStreamWriter, fillTable }
