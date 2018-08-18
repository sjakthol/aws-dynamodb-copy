# Sample setup for Amazon Linux 2 AMI based instance
sudo yum install -y htop
curl -vLO https://nodejs.org/dist/v8.11.4/node-v8.11.4-linux-x64.tar.xz
tar xf node-v8.11.4-linux-x64.tar.xz
export PATH=$PATH:$(pwd)/node-v8.11.4-linux-x64/bin
export AWS_REGION=eu-west-1
mkdir aws-dynamodb-copy
cd aws-dynamodb-copy/
# copy sources over
npm i
node scripts/fill_table.js --target-table test-source --num-items 100000 --rate 1000
node index.js --source-table test-source --target-table test-target --rate 5000
