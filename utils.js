const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");

export async function setupSyftCli() {
  core.info("Installing Syft");
  await exec.exec(`npm -g install @syftdata/cli`);
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

export async function postComent(octokit, issueNumber, comment) {
  if (issueNumber === 0) {
    core.warning("No issue number found, skipping posting comment");
    return;
  }
  const context = github.context;
  try {
    await octokit.issues.createComment({
      issue_number: issueNumber,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: comment,
    });
  } catch (e) {
    core.warning(`Failed to post comment, error: ${e.message}`);
  }
}
