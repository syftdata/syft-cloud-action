const path = require("path");
const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");
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
  await exec.exec("npx", [
    `syft`,
    "analyze",
    "--srcDir",
    fullProjectDir,
    "--output",
    outputDir,
    "--verbose",
  ]);
}

async function setup() {
  try {
    // Get version of tool to be installed
    const baseDir = path.join(process.cwd(), core.getInput("cwd") || "");
    const projectDirectory = core.getInput("project_directory");
    const outputDirectory = core.getInput("output_directory");

    core.info(`Syft Analysis starting..`);

    await utils.setupSyftCli();
    await runAnalysis(baseDir, projectDirectory, outputDirectory);
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup;

if (require.main === module) {
  setup();
}
