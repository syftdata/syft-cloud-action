const path = require("path");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const exec = require("@actions/exec");
const github = require("@actions/github");
const io = require("@actions/io");
const utils = require("./utils");

function getDownloadObject(version) {
  const url = "https://storage.googleapis.com/syft_cdn/syftdata-cli-v1.tgz";
  return {
    url,
  };
}

async function setupSyftCLI(workspaceDirectory) {
  const version = core.getInput("version");
  core.info(`Downloading the binary for version: ${version}`);
  const download = getDownloadObject(version);
  const pathToTarball = await tc.downloadTool(download.url);
  const pathToUnzip = await tc.extractTar(pathToTarball);

  const syftDir = path.join(workspaceDirectory, "../../syft");
  await io.cp(pathToUnzip, syftDir, {
    recursive: true,
    force: true,
  });
  const pathToCLI = path.join(syftDir, "dist-bundle");
  core.info("Installing dependencies");
  await exec.exec("npm", ["install", "--include-dev"], {
    cwd: pathToCLI,
  });
  return pathToCLI;
}

async function runInstrumentCommand(
  pathToCLI,
  workspaceDirectory,
  projectDirectory
) {
  core.info(
    `Running tests and instrumentor in ${projectDirectory} and workspace is: ${workspaceDirectory}`
  );
  const fullProjectDir = path.join(workspaceDirectory, projectDirectory);
  await exec.exec(
    "node",
    [
      `${pathToCLI}/lib/index.js`,
      "instrument",
      "--srcDir",
      fullProjectDir,
      "--input",
      path.join(fullProjectDir, "syft"),
      "--testSpecs",
      path.join(fullProjectDir, "syft", "tests"),
      "--verbose",
    ],
    {
      cwd: fullProjectDir,
    }
  );
}

async function setup() {
  try {
    // Get version of tool to be installed
    const workspaceDirectory = process.env.GITHUB_WORKSPACE;
    const projectDirectory = core.getInput("working_directory");
    const instrumentationToken = core.getInput("instrumentation_token");
    const githubToken = core.getInput("github_token");
    const octokit = github.getOctokit(githubToken);
    const issueNumber = await utils.getIssueNumber(octokit);

    core.info(`Syft Instrumentation starting: version: ${version}`);

    core.exportVariable("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD", "true");
    core.exportVariable("OPENAI_API_KEY", instrumentationToken);

    const pathToCLI = await setupSyftCLI(workspaceDirectory);
    await utils.setupPuppeteer();
    await runInstrumentCommand(pathToCLI, workspaceDirectory, projectDirectory);
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
