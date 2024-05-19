"use strict";

import { pathToFileURL } from "url";
import { realpathSync } from "fs";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import hi from "highland";

import ddb from "./lib/ddb.js";
import utils from "./lib/utils.js";

function run() {
  const args = yargs(hideBin(process.argv))
    .option("source-table", {
      alias: "s",
      desc: "The source table to copy from",
      required: true,
    })
    .option("source-table-region", {
      desc: "AWS region that hosts the source table",
      default: null,
      defaultDescription: "Current region",
    })
    .option("source-table-role-arn", {
      desc: "ARN of AWS IAM Role to assume for reading from the source table",
      default: null,
      defaultDescription: "No role (use default credentials)",
    })
    .option("target-table", {
      alias: "t",
      desc: "The target table to copy to",
      required: true,
    })
    .option("target-table-region", {
      desc: "AWS region that hosts the tager table",
      default: null,
      defaultDescription: "Current region",
    })
    .option("target-table-role-arn", {
      desc: "ARN of AWS IAM Role to assume for writing to the target table",
      default: null,
      defaultDescription: "No role (use default credentials)",
    })
    .option("rate", {
      alias: "r",
      desc: "Number of items to copy per second",
      required: true,
    })
    .option("parallelism", {
      alias: "p",
      desc: "Number of segments for DynamoDB parallel scan",
      default: 20,
    }).argv;

  const rate = parseInt(args.rate);
  const parallelism = parseInt(args.parallelism);
  const sourceTable = args.sourceTable;
  const sourceTableRegion = args.sourceTableRegion || undefined;
  const sourceTableRoleArn = args.sourceTableRoleArn || undefined;
  const targetTable = args.targetTable;
  const targetTableRegion = args.targetTableRegion || undefined;
  const targetTableRoleArn = args.targetTableRoleArn || undefined;

  const generators = [];
  for (let i = 0; i < parallelism; ++i) {
    generators.push(
      hi(
        ddb.createScanner(
          {
            Segment: i,
            TableName: sourceTable,
            TotalSegments: parallelism,
          },
          { region: sourceTableRegion, role: sourceTableRoleArn },
        ),
      ),
    );
  }
  return hi(generators)
    .merge()
    .through(
      ddb.createStreamWriter(targetTable, rate, {
        region: targetTableRegion,
        role: targetTableRoleArn,
      }),
    )
    .through(utils.createStreamThroughputReporter("output"))
    .collect()
    .toPromise(Promise);
}

/* istanbul ignore next */
if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  run().then(
    (res) => console.log("Done"),
    (err) => console.error(err, "Done"),
  );
}

export { run };
