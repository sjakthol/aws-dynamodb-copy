An utility for cloning contents of a DynamoDB table.

## Usage
```bash
$ npm i
$ node index.js --source-table <source> --target-table <target> --rate 2000
```

You need to ensure that the source and target tables have the required capacity to
sustain the given rate per second.

### Arguments
* `--source-table` / `-s` - The source table to copy from.
* `--source-table-region` - AWS region that hosts the source table [default: Current region]
* `--target-table` / `-t` - The target table to copy to.
* `--target-table-region` - AWS region that hosts the target table [default: Current region]
* `--rate` / `-r` - Number of items to copy per second.
* `--parallelism` / `-p` - Number of segments for DynamoDB parallel scan [default: 20]

## Performance
The script is able to provide a sustained rate of at least 20000 copies per second (running
on an `c5.xlarge` instance).

## Improvement Ideas:
* Support copying tables across AWS accounts (different read / write roles)
* Support resuming aborted operation
* Support adapting the rate to a fraction of the capacity provisioned for the table
