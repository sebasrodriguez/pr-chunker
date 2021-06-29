const core = require('@actions/core');
const exec = require('@actions/exec');

console.log(`Creating PR if it exceeds ${core.getInput('max-diff')}`);
console.log(`Diffing against ${core.getInput('staging-branch')}`);

exec.exec(`git diff ${core.getInput('staging-branch')}`);