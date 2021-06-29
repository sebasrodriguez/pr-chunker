const core = require("@actions/core");
const exec = require("@actions/exec");

console.log(`Creating PR if it exceeds ${core.getInput("max-diff")}`);
console.log(`Diffing against ${core.getInput("staging-branch")}`);

exec
  .getExecOutput(
    `git diff --shortstat origin/${core.getInput("staging-branch")}`
  )
  .then((value) => {
    console.log(value.stdout);
  });

exec.exec('gh --help');