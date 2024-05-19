const fs = require("fs");
const config = require("eslint-config-prettier");

module.exports = [
  {
    ignores: fs.readFileSync(".gitignore", "utf8").split("\n"),
  },
  config,
];
