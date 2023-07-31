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
  await exec.exec("npm", ["install", "--include-dev", "--force"], {
    cwd: pathToCLI,
  });
  return pathToCLI;
}

async function runTests(pathToCLI, workspaceDirectory, projectDirectory) {
  core.info(
    `Running tests in ${projectDirectory} and workspace is: ${workspaceDirectory}`
  );
  const fullProjectDir = path.join(workspaceDirectory, projectDirectory);
  const { exitCode, stdout } = await exec.getExecOutput(
    "node",
    [
      `${pathToCLI}/lib/index.js`,
      "test1",
      "--eventTags",
      path.join(fullProjectDir, "syft", "event_tags.json"),
    ],
    {
      cwd: pathToCLI,
      ignoreReturnCode: true,
    }
  );
  return exitCode;
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
  const { exitCode } = await exec.getExecOutput(
    "node",
    [
      `${pathToCLI}/lib/index.js`,
      "instrument1",
      "--srcDir",
      fullProjectDir,
      "--input",
      path.join(fullProjectDir, "syft"),
      "--eventTags",
      path.join(fullProjectDir, "syft", "event_tags.json"),
      "--verbose",
    ],
    {
      cwd: pathToCLI,
    }
  );
  if (exitCode === 0) {
    return await runTests(pathToCLI, workspaceDirectory, projectDirectory);
  } else {
    return exitCode;
  }
}

async function setup() {
  try {
    // Get version of tool to be installed
    const workspaceDirectory = process.env.GITHUB_WORKSPACE;
    const projectDirectory = core.getInput("working_directory");
    const instrumentationToken = core.getInput("instrumentation_token");

    const githubToken = core.getInput("github_token");
    const octokit = github.getOctokit(githubToken);

    core.exportVariable("OPENAI_API_KEY", instrumentationToken);

    const pathToCLI = await setupSyftCLI(workspaceDirectory);

    let exitCode = await runTests(
      pathToCLI,
      workspaceDirectory,
      projectDirectory
    );
    if (exitCode !== 0) {
      core.info(
        `Syft found events that require instrumentation. Attempting to auto instrumentation..`
      );
      const issueNumber = await utils.getIssueNumber(octokit);
      utils.postComent(
        octokit,
        issueNumber,
        `Hi there, Syft found changes to events. Attempting to auto instrument!`
      );
      exitCode = await runInstrumentCommand(
        octokit,
        pathToCLI,
        workspaceDirectory,
        projectDirectory
      );
      if (exitCode !== 0) {
        core.info(`Failed to auto instrument`);
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
