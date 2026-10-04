const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs/promises');
const path = require('path');
module.exports = config => {
  config = withMainApplication(config, mod => {
    if (!mod.modResults.contents.includes('add(SaveMeCryptoPackage())')) {
      mod.modResults.contents = mod.modResults.contents.replace('return PackageList(this).packages', 'return PackageList(this).packages.apply { add(SaveMeCryptoPackage()) }');
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const root = mod.modRequest.projectRoot;
    const target = path.join(root, 'android/app/src/main/java/com/saveme/secure');
    await fs.mkdir(target, { recursive: true });
    for (const name of ['SaveMeCryptoModule.java', 'SaveMeCryptoPackage.java']) await fs.copyFile(path.join(root, 'native', name), path.join(target, name));
    return mod;
  }]);
};
