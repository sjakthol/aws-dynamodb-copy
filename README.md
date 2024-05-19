An utility for cloning contents of a DynamoDB table.

## Usage

```bash
$ npm i
$ node index.js --source-table <source> --target-table <target> --rate 2000
```

You need to ensure that the source and target tables have the required capacity to
sustain the given rate per second.

### Arguments

- `--source-table` / `-s` - The source table to copy from.
- `--source-table-region` - AWS region that hosts the source table [default: Current region]
- `--source-table-role-arn` - ARN of AWS IAM Role to assume for reading from the source table [default: No role (use default credentials)]
- `--target-table` / `-t` - The target table to copy to.
- `--target-table-region` - AWS region that hosts the target table [default: Current region]
- `--target-table-role-arn` - ARN of AWS IAM Role to assume for writing to the target table [default: No role (use default credentials)]
- `--rate` / `-r` - Number of items to copy per second.
- `--parallelism` / `-p` - Number of segments for DynamoDB parallel scan [default: 20]

### Permissions

This tool requires the following permissions:

- `dynamodb:Scan` on the source table
- `dynamodb:BatchWriteItem` on the target table
- `sts:AssumeRole` on source and/or target table role to assume for reads / writes

If assumed role is used for reads and/or writes, the assumed role must have the appropriate DynamoDB
permission to the relevant table.

## Performance

The script is able to provide a sustained rate of at least 20000 copies per second (running
on an `c5.xlarge` instance).

## Improvement Ideas:

- Support resuming aborted operation
- Support adapting the rate to a fraction of the capacity provisioned for the table
