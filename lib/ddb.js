'use strict'

const AWS = require('aws-sdk')
const crypto = require('crypto')
const hi = require('highland')
const utils = require('./utils')
const ddb = new AWS.DynamoDB()

/**
 * Writes a batch of items to DynamoDB really hard.
 *
 * @param {AWS.DynamoDB.BatchWriteItemRequestMap} batch
 * @returns {Promise<void>}
 */
async function batchWriteItems (batch) {
  const batchId = crypto.randomBytes(4).toString('hex')
  let attempt = 0
  let unprocessed = batch
  do {
    const res = await ddb.batchWriteItem({ RequestItems: unprocessed }).promise()
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
 * @returns {(x: Highland.Stream) => Highland.Stream}
 */
function createStreamWriter (table, ratelimit) {
  return stream =>
    stream
      .through(utils.createContinuousRateLimiter(ratelimit))
      .batch(25)
      .map(hi.wrapCallback(function (batch, callback) {
        const items = batch.map(Item => ({ PutRequest: { Item } }))
        batchWriteItems({
          [table]: items
        })
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
 * @param {AWS.DynamoDB.Types.ScanInput} opts options to the scan operation
 * @return {(push: (err: Error | null, x?: Object | Highland.Nil) => void, next: () => void) => void} a highland generator function
 */
function createScanner (opts) {
  return function scanner (push, next) {
    ddb.scan(opts, function (err, data) {
      if (err) {
        push(err)
        return next()
      }

      for (const item of data.Items) {
        push(null, item)
      }

      opts.ExclusiveStartKey = data.LastEvaluatedKey
      if (!data.LastEvaluatedKey) {
        push(null, hi.nil)
        return
      }

      return next()
    })
  }
}

module.exports = { batchWriteItems, createScanner, createStreamWriter }
