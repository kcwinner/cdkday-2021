const { JsiiProject } = require('projen');
const project = new JsiiProject({
  name: '@kcwinner/cdkday-2021',
  repositoryUrl: 'https://github.com/kcwinner/cdkday-2021.git',
  author: 'Ken Winner',
  authorAddress: 'kcswinner@gmail.com',
  defaultReleaseBranch: 'main',

  deps: ['projen'],
  peerDeps: ['projen'],
  devDeps: [
    'fs-extra',
    '@types/fs-extra@^8',
  ],

  dependabot: false, // Disabling because it is a demo project
  mergify: false, // Disabling because it is a demo project

  npmDistTag: 'latest',
  npmRegistryUrl: 'https://npm.pkg.github.com',
});

project.synth();