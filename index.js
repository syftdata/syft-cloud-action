const path = require("path");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");
const exec = require("@actions/exec");
const github = require("@actions/github");
const io = require("@actions/io");
const utils = require("./utils");

async function runAnalysis(
  workspaceDirectory,
  projectDirectory,
  outputDirectory
) {
  core.info(
    `Running tests and instrumentor in ${projectDirectory} and workspace is: ${workspaceDirectory}`
  );
  const fullProjectDir = path.join(workspaceDirectory, projectDirectory);
  const outputDir = path.join(workspaceDirectory, outputDirectory);
  await exec.exec(
    "npx",
    [
      `syft`,
      "analyze",
      "--srcDir",
      fullProjectDir,
      "--output",
      outputDir,
      "--verbose",
    ],
    {
      cwd: pathToCLI,
    }
  );
}

async function setup() {
  try {
    // Get version of tool to be installed
    const workspaceDirectory = process.env.GITHUB_WORKSPACE;
    const projectDirectory = core.getInput("project_directory");
    const outputDirectory = core.getInput("output_directory");

    core.info(`Syft Analysis starting..`);

    await utils.setupSyftCli();
    await runAnalysis(workspaceDirectory, projectDirectory, outputDirectory);

    // const githubToken = core.getInput("github_token");
    // const octokit = github.getOctokit(githubToken);
    // const issueNumber = await utils.getIssueNumber(octokit);
    // utils.postComent(octokit, issueNumber, "Instrumentation` complete");
    // `Hi there, I found some changes on syft events.
    // - I found **3 new syft events**.
    // - **3 events** are failing with this [Test Spec.](http://google.com)

    // ### Details

    // | Command            | Description                      |
    // | ------------------ | -------------------------------- |
    // | Events             | **5** <sub><sup>(+3)</sup></sub> |
    // | Test Specs         | **1** <sub><sup>(+1)</sup></sub> |
    // | Failing Test Specs | **1** <sub><sup>(+1)</sup></sub> |
    // | Failing Events     | **3** <sub><sup>(+3)</sup></sub> |

    // I will attempt to make code changes to meet all Test specs.`;
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
