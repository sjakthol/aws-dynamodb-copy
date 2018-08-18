An utility for cloning contents of a DynamoDB table.

## Usage
```bash
$ npm i
$ node index.js --source-table <source> --target-table <target> --rate 2000
```

You need to ensure that the source and target tables have the required capacity to
sustain the given rate per second.

### Required Arguments
* `--source-table` / `-s` - The source table to copy from.
* `--target-table` / `-t` - The target table to copy to.
* `--rate` / `-r` - Number of items to copy per second.

## Performance
The script is able to provide a sustained rate of at least 10000 copies per second (running
on an `m5.large` instance). Higher rates have not been tested.

## Improvement Ideas:
* Support copying tables across AWS regions
* Support copying tables across AWS accounts (different read / write roles)
* Support resuming aborted operation
* Support adapting the rate to a fraction of the capacity provisioned for the table
