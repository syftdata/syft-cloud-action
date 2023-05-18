const path = require("path");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const exec = require("@actions/exec");
const github = require("@actions/github");

function getDownloadObject(version) {
  const filename = "syft-studio-cli";
  const extension = "tgz";
  const binPath = "bin";
  //const url = `https://github.com/cli/cli/releases/download/v${version}/${filename}.${extension}`;
  const url = "https://storage.cloud.google.com/syft_cdn/syftdata-cli.tgz";
  return {
    url,
    binPath,
  };
}

async function setupPuppeteer() {
  await exec.exec(`sudo apt-get update`);
  await exec.exec(`sudo apt-get install -yq libgconf-2-4`);
  await exec.exec(`sudo apt-get install -y wget xvfb --no-install-recommends`);
  await exec.exec(
    `wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add - `
  );
  await exec.exec(
    `sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'`
  );
  await exec.exec(`sudo apt-get update`);
  await exec.exec(
    `sudo apt-get install -y google-chrome-stable --no-install-recommends`
  );
  await exec.exec(`sudo rm -rf /var/lib/apt/lists/*`);
}

async function getIssueNumber(octokit) {
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
}

async function setup() {
  try {
    // Get version of tool to be installed
    const version = core.getInput("version");
    const workingDirectory = core.getInput("working_directory");
    const instrumentationToken = core.getInput("instrumentation_token");
    const githubToken = core.getInput("github_token");

    core.log(`Syft Instrumentation starting: version: ${version}`);

    const context = github.context;
    const octokit = github.getOctokit(githubToken);
    const issueNumber = getIssueNumber(octokit);

    core.exportVariable("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD", "true");
    core.exportVariable("OPENAI_API_KEY", instrumentationToken);

    core.workingDirectory(workingDirectory);

    core.log(
      `Downloading the binary for version: ${version}, PR is: ${issueNumber}`
    );
    // Download the specific version of the tool, e.g. as a tarball/zipball
    const download = getDownloadObject(version);
    const pathToTarball = await tc.downloadTool(download.url);

    // Extract the tarball/zipball onto host runner
    const extract = download.url.endsWith(".zip")
      ? tc.extractZip
      : tc.extractTar;

    const pathToCLI = await extract(pathToTarball);
    core.log("Installing dependencies");
    await exec.exec("npm install --include-dev");
    // Expose the tool by adding it to the PATH
    //core.addPath(path.join(pathToCLI, download.binPath));
    await setupPuppeteer();
    core.log("Running tests and instrumentor");
    await exec.exec("node", [
      `${pathToCLI}/lib/index.js`,
      "instrument",
      `--testSpecs ${workingDirectory}`,
    ]);
    //
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
