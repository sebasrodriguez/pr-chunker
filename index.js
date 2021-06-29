const core = require('@actions/core');

console.log(`Creating PR if it exceeds ${core.getInput('max-diff')}`);
console.log(`Creating PR if it exceeds ${core.getInput('staging-branch')}`);