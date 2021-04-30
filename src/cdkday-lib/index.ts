import * as path from 'path'; // eslint-disable-line
import { TypeScriptAppProject, TypeScriptProjectOptions } from 'projen';

export interface CdkDayLibOptions extends TypeScriptProjectOptions {}

/**
 * CDK Day Demo Library in TypeScript
 *
 * @pjid cdkday-lib
 */
export class CdkDayLib extends TypeScriptAppProject {
  public readonly projectName: string;

  constructor(options: CdkDayLibOptions) {
    super({
      ...options,

      // Custom project stuff
      licensed: options.licensed ?? false, // default to unlicensed because its org internal
      npmRegistryUrl: 'https://npm.pkg.github.com',
      npmDistTag: 'latest',
    });

    this.projectName = path.basename(process.cwd());

    // Custom ES Lint Rule
    this.eslint?.addRules({
      quotes: [
        'error',
        'double',
        {
          avoidEscape: true,
        },
      ],
    });
  }
}