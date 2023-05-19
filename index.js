const path = require("path");
const fs = require("fs");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const exec = require("@actions/exec");
const github = require("@actions/github");

function getDownloadObject(version) {
  const filename = "syft-studio-cli";
  const extension = "tgz";
  const binPath = "bin";
  //const url = `https://github.com/cli/cli/releases/download/v${version}/${filename}.${extension}`;
  const url = "https://storage.googleapis.com/syft_cdn/syftdata-cli.tgz";
  return {
    url,
    binPath,
  };
}

async function setupPuppeteer() {
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
}

async function getIssueNumber(octokit) {
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

async function setup() {
  try {
    // Get version of tool to be installed
    const version = core.getInput("version");
    const workingDirectory = core.getInput("working_directory");
    const instrumentationToken = core.getInput("instrumentation_token");
    const githubToken = core.getInput("github_token");

    core.info(`Syft Instrumentation starting: version: ${version}`);

    const octokit = github.getOctokit(githubToken);
    const issueNumber = await getIssueNumber(octokit);

    core.exportVariable("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD", "true");
    core.exportVariable("OPENAI_API_KEY", instrumentationToken);

    core.info(
      `Downloading the binary for version: ${version}, PR is: ${issueNumber}`
    );

    core.info("Installing puppeteer dependencies");
    await setupPuppeteer();

    // Download the specific version of the tool, e.g. as a tarball/zipball
    core.info("Downloading code assistor brain");
    const download = getDownloadObject(version);
    const pathToTarball = await tc.downloadTool(download.url);
    const pathToUnzip = await tc.extractTar(pathToTarball);
    const pathToCLI = path.join(pathToUnzip, "dist-bundle");

    core.info("Installing dependencies");
    await exec.exec("npm", ["install", "--include-dev"], {
      cwd: pathToCLI,
    });
    core.info("Running tests and instrumentor");
    await exec.exec(
      "node",
      [`${pathToCLI}/lib/index.js`, "instrument", `--testSpecs syft/tests`],
      {
        cwd: workingDirectory,
      }
    );
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
