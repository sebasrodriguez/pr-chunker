const core = require("@actions/core");
const exec = require("@actions/exec");
const { request } = require("@octokit/request");

const limit = +core.getInput("max-diff") - +core.getInput("buffer");
const baseBranch = core.getInput("base-branch");
console.log(`Creating PR if it exceeds ${limit}`);
console.log(`Diffing against ${core.getInput("base-branch")}`);
console.log(process.env.GITHUB_REPOSITORY);

const getMissingCommits = async (baseBranch, branch) => {
  const { stdout } = await exec.getExecOutput(
    `git log ${baseBranch} ^${branch} --format=format:%H`
  );

  const result = stdout.split("\n").reverse();

  return result;
};

const getDiff = async (origin, target) => {
  const { stdout } = await exec.getExecOutput(
    `git diff ${target}..${origin} --shortstat`
  );
  const regExp =
    /((?<insertions>\d+)\sinsertions)|((?<deletion>\d+)\sdeletion)/;
  const match = regExp.exec(stdout);

  const totalDiff =
    (+match.groups.deletion || 0) + (+match.groups.insertions || 0);

  return totalDiff;
};

const getPRCommit = async () => {
  const missingCommits = await getMissingCommits(
    `origin/develop`,
    `origin/${baseBranch}`
  );

  for (let index = 0; index < missingCommits.length; index++) {
    const localDiff = await getDiff(
      missingCommits[index],
      `origin/${baseBranch}`
    );

    if (localDiff >= limit) {
      const commitIdForPR =
        index === 0 ? missingCommits[0] : missingCommits[index - 1];

      return commitIdForPR;
    }
  }
};

const createBranchIfNotExists = async (commitId) => {
  let exists = false;
  const branch = `auto-merger/${commitId}`;
  try {
    const { stdout } = await exec.getExecOutput(
      `git rev-parse --verify ${branch}`
    );
    exists = stdout.includes(commitId);
  } catch (e) {
    exists = false;
  }

  if (exists) {
    console.info("AutoMerger: Branch already exists, skipping creation");
  } else {
    await exec.exec(`git branch ${branch} ${commitId}`);
    await exec.exec(`git push -u origin ${branch}`);
  }

  return branch;
};

const createPRIfNotExists = async (branch, commitId) => {
  const response = await request(`GET /search/issues`, {
      q: 'is:pr is:open'
  });

  console.log(response);
//   const searchOutput = await exec.getExecOutput(
//     `gh pr list --search "body:'${commitId}'"`
//   );

//   if (searchOutput.stdout.includes("No pull requests match your search")) {
//     const createOutput = await exec.getExecOutput(
//       `gh pr create --base staging --title "[AutoMerger]: ${commitId}" --body "${commitId}" --head "${branch}"`
//     );
//   } else {
//     console.info("AutoMerger: PR already exists, skipping creation");
//   }
};

const run = async () => {
  try {
    const diff = await getDiff("origin/develop", `origin/${baseBranch}`);

    if (diff >= limit) {
      console.log(
        `AutoMerger: Should create pr because we have ${diff} lines changed`
      );
      const commitIdForPR = await getPRCommit();
      const branch = await createBranchIfNotExists(commitIdForPR);
      await createPRIfNotExists(branch, commitIdForPR);
    } else {
      console.log("AutoMerger: Skipping automatic pr creation");
    }
  } catch (e) {
    console.log(e);
  }
};

run();
