const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");

export async function setupPuppeteer() {
  core.info("Installing puppeteer dependencies");
  await exec.exec(`sudo apt-get update`);
  await exec.exec(`sudo apt-get install -yq libgconf-2-4`);
  await exec.exec(`sudo apt-get install -y wget xvfb --no-install-recommends`);
  const { stdout } = await exec.getExecOutput(
    `wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub`,
    [],
    {
      silent: true,
    }
  );
  await exec.exec(`sudo apt-key add -`, [], {
    input: stdout,
  });
  await exec.exec("sudo tee -a /etc/apt/sources.list.d/google.list", [], {
    input:
      "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main",
  });
  await exec.exec(`sudo apt-get update`);
  await exec.exec(
    `sudo apt-get install -y google-chrome-stable --no-install-recommends`
  );
  await exec.exec(`sudo rm -rf /var/lib/apt/lists/*`);
  core.setE;
}

export async function getIssueNumber(octokit) {
  try {
    const context = github.context;
    const issue = context.payload.issue;
    if (issue) {
      return issue.number;
    }
    // Otherwise return issue number from commit
    const issueNumber = (
      await octokit.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: context.sha,
        owner: context.repo.owner,
        repo: context.repo.repo,
      })
    ).data[0].number;
    return issueNumber;
  } catch (e) {
    core.warning(
      `Failed to get issue number from context, error: ${e.message}`
    );
    return 0;
  }
}
