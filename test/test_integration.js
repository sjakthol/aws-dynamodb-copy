/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('dirty-chai'))

const crypto = require('crypto')
const hi = require('highland')
const fs = require('fs')
const path = require('path')
const {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  waitUntilStackCreateComplete
} = require('@aws-sdk/client-cloudformation')
const ddb = require('../lib/ddb')

const RUN_ID = Date.now() + '-' + crypto.randomBytes(4).toString('hex')
const StackName = `aws-dynamodb-copy-${RUN_ID}-${crypto.randomBytes(4).toString('hex')}`
const cfn = new CloudFormationClient({})
const stacks = []

/**
 * Helper to create test resources with a CloudFormation stack.
 */
async function createTestResources () {
  console.error(`Creating stack ${StackName}`)

  const TemplateBody = fs.readFileSync(path.join(__dirname, 'templates', 'test-resources.yaml'), { encoding: 'utf-8' })
  const cmd = new CreateStackCommand({
    StackName,
    OnFailure: 'DELETE',
    TemplateBody
  })
  const stack = await cfn.send(cmd).catch(function (err) {
    if (err.message === 'Region is missing') {
      console.error(`Skipping test: ${err.message}`)
      return
    }
    const skipOnErrors = new Set(['ExpiredToken', 'CredentialsError', 'AccessDenied'])
    if (skipOnErrors.has(err.Code)) {
      console.error(`Skipping test: ${err.Code}`)
      return
    }

    throw err
  })

  if (!stack) {
    return
  }

  stacks.push(stack.StackId)
  await waitUntilStackCreateComplete({ client: cfn, maxWaitTime: 120 }, { StackName: stack.StackId })
}

describe('integration test', function () {
  this.timeout(120000)
  const origArgv = process.argv
  const sandbox = sinon.createSandbox()

  const testSourceTable = `${StackName}-SourceTable`
  const testTargetTable = `${StackName}-TargetTable`

  before(async () => {
    await createTestResources()
  })

  beforeEach(() => {
    delete require.cache[require.resolve('../index')]
  })

  afterEach(async () => {
    process.argv = origArgv
    sandbox.reset()
  })

  after(async () => {
    await Promise.all(stacks.map(async stack => {
      console.error(`Deleting stack ${stack}`)
      await cfn.send(new DeleteStackCommand({ StackName: stack }))
    }))
  })

  after(() => {
    sandbox.restore()
  })

  it('should copy table contents', async function () {
    await ddb.fillTable(testSourceTable, 10, 10, 'pk')

    process.argv = ['node', 'index.js', '--source-table', testSourceTable, '--target-table', testTargetTable, '--rate', '10', '--parallelism', '20']
    const index = require('../index')
    await await index.run()

    const targetItems = await hi(ddb.createScanner({
      TableName: testTargetTable
    })).collect().toPromise(Promise)

    expect(targetItems).to.have.lengthOf(10)
  })
})
