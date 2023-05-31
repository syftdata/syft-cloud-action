const path = require("path");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const exec = require("@actions/exec");
const github = require("@actions/github");
const io = require("@actions/io");
const utils = require("./utils");

function getDownloadObject(version) {
  const url = `https://storage.googleapis.com/syft_cdn/syftdata-cli-v${version}.tgz`;
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

async function runTests(
  octokit,
  pathToCLI,
  workspaceDirectory,
  projectDirectory
) {
  core.info(
    `Running tests in ${projectDirectory} and workspace is: ${workspaceDirectory}`
  );
  const fullProjectDir = path.join(workspaceDirectory, projectDirectory);
  const { exitCode, stdout } = await exec.getExecOutput(
    "node",
    [
      `${pathToCLI}/lib/index.js`,
      "test",
      "--testSpecs",
      path.join(fullProjectDir, "syft", "tests"),
    ],
    {
      cwd: pathToCLI,
      ignoreReturnCode: true,
    }
  );

  // const issueNumber = await utils.getIssueNumber(octokit);
  // if (issueNumber != 0) {
  //   utils.postComent(octokit, issueNumber, "Instrumentation` complete");
  //   `Hi there, I found some changes on syft events.
  //     - I found **3 new syft events**.
  //     - **3 events** are failing with this [Test Spec.](http://google.com)

  //     ### Details

  //     | Command            | Description                      |
  //     | ------------------ | -------------------------------- |
  //     | Events             | **5** <sub><sup>(+3)</sup></sub> |
  //     | Test Specs         | **1** <sub><sup>(+1)</sup></sub> |
  //     | Failing Test Specs | **1** <sub><sup>(+1)</sup></sub> |
  //     | Failing Events     | **3** <sub><sup>(+3)</sup></sub> |

  //     I will attempt to make code changes to meet all Test specs.`;
  // }
  return exitCode === 0;
}

async function runInstrumentCommand(
  octokit,
  pathToCLI,
  workspaceDirectory,
  projectDirectory
) {
  core.info(
    `Running instrumentation in ${projectDirectory} and workspace is: ${workspaceDirectory}`
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
      cwd: pathToCLI,
    }
  );
  return await runTests(
    octokit,
    pathToCLI,
    workspaceDirectory,
    projectDirectory
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

    //core.exportVariable("PUPPETEER_SKIP_CHROMIUM_DOWNLOAD", "true");
    core.exportVariable(
      "PUPPETEER_CACHE_DIR",
      path.join(workspaceDirectory, ".cache", "puppeteer")
    );

    core.exportVariable("OPENAI_API_KEY", instrumentationToken);

    const pathToCLI = await setupSyftCLI(workspaceDirectory);
    await utils.setupPuppeteer();

    let result = await runTests(
      octokit,
      pathToCLI,
      workspaceDirectory,
      projectDirectory
    );
    if (!result) {
      core.info(`Syft tests are failing. Attempting to auto instrumentation..`);
      result = await runInstrumentCommand(
        octokit,
        pathToCLI,
        workspaceDirectory,
        projectDirectory
      );
      if (!result) {
        core.info(`Syft tests are failing after instrumentation. Giving up.`);
      }
    }
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
