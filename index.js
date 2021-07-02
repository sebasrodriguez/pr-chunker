const core = require("@actions/core");
const exec = require("@actions/exec");
const { request } = require("@octokit/request");

const token = process.env.GITHUB_TOKEN;
const limit = +core.getInput("max-diff");
const mainBranch = core.getInput("main-branch");
const baseBranch = core.getInput("base-branch");

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
    /((?<insertions>\d+)\sinsertions)|((?<deletion>\d+)\sdeletion)/gm;
  const match = regExp.exec(stdout);

  const totalDiff = !match
    ? 0
    : (+match.groups.deletion || 0) + (+match.groups.insertions || 0);

  console.log(match.groups);

  return totalDiff;
};

const getPRCommit = async () => {
  const missingCommits = await getMissingCommits(
    `origin/${mainBranch}`,
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
    core.info("AutoMerger: Branch already exists, skipping creation");
  } else {
    await exec.exec(`git branch ${branch} ${commitId}`);
    await exec.exec(`git push -u origin ${branch}`);
  }

  return branch;
};

const createPRIfNotExists = async (branch, commitId) => {
  const [owner] = process.env.GITHUB_REPOSITORY.split("/");
  const response = await request(
    `GET /repos/${process.env.GITHUB_REPOSITORY}/pulls`,
    {
      headers: {
        authorization: `token ${token}`,
      },
      base: baseBranch,
      head: `${owner}:${branch}`,
    }
  );

  if (response.data.length === 0) {
    const response = await request(
      `POST /repos/${process.env.GITHUB_REPOSITORY}/pulls`,
      {
        headers: {
          authorization: `token ${token}`,
        },
        title: `[AutoMerger]: ${commitId}`,
        head: branch,
        base: baseBranch,
        body: `This PR was automatically created by AutoMerger`,
      }
    );
    core.info(`AutoMerger: PR created, ${response.data.url}`);
  } else {
    core.info("AutoMerger: PR already exists, skipping creation");
  }
};

const run = async () => {
  try {
    const diff = await getDiff(`origin/${mainBranch}`, `origin/${baseBranch}`);

    console.log({ diff, limit });
    if (diff >= limit) {
      core.info(
        `AutoMerger: Will create PR if not exists because we have ${diff} lines changed`
      );
      const commitIdForPR = await getPRCommit();
      const branch = await createBranchIfNotExists(commitIdForPR);
      await createPRIfNotExists(branch, commitIdForPR);
    } else {
      core.info("AutoMerger: Skipping automatic pr creation");
    }
  } catch (e) {
    core.error(e);
  }
};

run();
