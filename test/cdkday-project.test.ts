import { CdkDayProject } from '../src';

test('CDK Day Project', () => {
  // Show the forced 1.95.2
  const project = new CdkDayProject({
    name: 'test',
    cdkVersion: '1.100.0',
    defaultReleaseBranch: 'main',
  });

  expect(project.cdkVersion).toEqual('1.95.2');
  expect(project.srcdir).toEqual('src');
  expect(project.libdir).toEqual('lib');
});