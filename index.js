const path = require('path');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');

function getDownloadObject(version) {
  const filename = 'syft-studio-cli';
  const extension = 'tar.gz';
  const binPath = 'bin';
  const url = `https://github.com/cli/cli/releases/download/v${ version }/${ filename }.${ extension }`;
  return {
    url,
    binPath
  };
}

async function setup() {
  try {
    // Get version of tool to be installed
    const version = core.getInput('version');

    // Download the specific version of the tool, e.g. as a tarball/zipball
    const download = getDownloadObject(version);
    const pathToTarball = await tc.downloadTool(download.url);

    // Extract the tarball/zipball onto host runner
    const extract = download.url.endsWith('.zip') ? tc.extractZip : tc.extractTar;
    const pathToCLI = await extract(pathToTarball);

    // Expose the tool by adding it to the PATH
    core.addPath(path.join(pathToCLI, download.binPath));
  } catch (e) {
    core.setFailed(e);
  }
}

module.exports = setup

if (require.main === module) {
  setup();
}
