import * as fs from 'fs-extra'; // eslint-disable-line
import * as path from 'path'; // eslint-disable-line
import { AwsCdkTypeScriptApp, AwsCdkTypeScriptAppOptions, Component, SampleDir, TextFile } from 'projen';
import { pascalCase } from '../pascalCase';

export interface CdkDayProjectOptions extends AwsCdkTypeScriptAppOptions {
  /**
   * Prettier ignore settings
   * @default ['*']
   */
  readonly prettierIgnore?: string[];
}

/**
 * CDK Day Demo Project in TypeScript
 *
 * @pjid cdkday-project
 */
export class CdkDayProject extends AwsCdkTypeScriptApp {
  public readonly projectName: string;

  constructor(options: CdkDayProjectOptions) {
    super({
      ...options,
      sampleCode: false,

      // Custom project stuff
      licensed: false, // example: our private package is unlicensed because its org internal

      // Example pinning
      cdkVersion: '1.95.2',
      cdkVersionPinning: true,
      context: {
        '@aws-cdk/core:newStyleStackSynthesis': 'true',
      },
    });

    this.projectName = path.basename(process.cwd());

    this.addCdkDependency(...[
      '@aws-cdk/aws-iam',
      '@aws-cdk/aws-sns',
      '@aws-cdk/aws-sns-subscriptions',
      '@aws-cdk/pipelines',
      '@aws-cdk/aws-codebuild',
      '@aws-cdk/aws-codepipeline',
      '@aws-cdk/aws-codepipeline-actions',
      '@aws-cdk/aws-codestarnotifications',
    ]);

    const prettierIgnoreLines = options.prettierIgnore ?? ['*'];
    new TextFile(this, '.prettierignore', {
      lines: prettierIgnoreLines,
    });

    if (options.sampleCode ?? true) {
      new SampleCode(this);
    }
  }
}

class SampleCode extends Component {
  private readonly demoProject: CdkDayProject;
  private readonly devAccount = '111111111111';
  private readonly preprodAccount = '222222222222';
  private readonly prodAccount = '3333333333333';

  constructor(project: CdkDayProject) {
    super(project);
    this.demoProject = project;
  }

  public synthesize() {
    // Check if ts files exist. If so, do NOT create sample code
    if (fs.pathExistsSync(this.demoProject.srcdir) && fs.readdirSync(this.demoProject.srcdir).filter(x => x.endsWith('.ts'))) {
      return;
    }

    const projectType = pascalCase(this.demoProject.projectName);

    new SampleDir(this.demoProject, this.demoProject.srcdir, {
      files: {
        'main.ts': this.createMainTsContents(this.demoProject.projectName, projectType),
      },
    });

    const libDir = path.join(this.demoProject.srcdir, 'lib');
    new SampleDir(this.demoProject, libDir, {
      files: {
        [`${this.demoProject.projectName}-stack.ts`]: this.projectStackContents(this.demoProject.projectName, projectType),
      },
    });

    const testCode = `import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import { ${projectType}Stack } from '../src/lib/${this.demoProject.projectName}-stack';

test('Basic Test', () => {
  const app = new App();
  const stack = new ${projectType}Stack(app, 'test');
  expect(stack).toHaveResource('AWS::SNS::Topic');
});`;

    const testdir = path.join(this.demoProject.testdir);
    new SampleDir(this.demoProject, testdir, {
      files: {
        'main.test.ts': testCode,
      },
    });
  }

  private createMainTsContents(projectName: string, projectType: string): string {
    return `import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as actions from '@aws-cdk/aws-codepipeline-actions';
import * as cdk from '@aws-cdk/core';
import * as pipelines from '@aws-cdk/pipelines';

import { ${projectType}Stack } from './lib/${projectName}-stack';

const DEV_ACCOUNT = '${this.devAccount}';
const PREPROD_ACCOUNT = '${this.preprodAccount}';
const PROD_ACCOUNT = '${this.prodAccount}';
const REGION = 'us-east-1';

export type PipelineStageProps<T> = T & {
  recordName: string;
  environment: string;
};


class Stage extends cdk.Stage {
  constructor(scope: cdk.Construct, id: string, props: PipelineStageProps<cdk.StageProps>) {
    super(scope, id, props);

    new ${projectType}Stack(this, 'Primary${projectType}Stack', {
      environment: props.environment,
      env: {
        ...props.env,
      },
    });
  }
}

interface PipelineProps extends cdk.StackProps {
  repo: string;

  branch?: string;
}

class PipelineStack extends cdk.Stack {
  public readonly sourceArtifact: codepipeline.Artifact;
  public readonly cloudAssemblyArtifact: codepipeline.Artifact;
  readonly githubToken: cdk.SecretValue;

  private pipeline: pipelines.CdkPipeline;

  constructor(scope: cdk.Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    this.sourceArtifact = new codepipeline.Artifact('SourceArtifact');
    this.cloudAssemblyArtifact = new codepipeline.Artifact('CloudAssemblyArtifact');

    this.githubToken = cdk.SecretValue.secretsManager('arn:aws:.....:token', {
      jsonField: 'tokenField',
    });

    const sourceAction = new actions.GitHubSourceAction({
      actionName: 'Source',
      output: this.sourceArtifact,
      owner: 'MyGithubOrganization',
      repo: props.repo,
      branch: props.branch ?? 'main',
      oauthToken: this.githubToken,
    });

    const synthAction = new pipelines.SimpleSynthAction({
      buildCommand: 'npm run build',
      synthCommand: 'npx cdk synth',
      sourceArtifact: this.sourceArtifact,
      cloudAssemblyArtifact: this.cloudAssemblyArtifact,
    });

    this.pipeline = new pipelines.CdkPipeline(this, '${projectType}Pipeline', {
      cloudAssemblyArtifact: this.cloudAssemblyArtifact,
      sourceAction,
      synthAction,
    });

    this.pipeline.addApplicationStage(
      new Stage(this, 'Preprod', {
        recordName: 'api',
        environment: 'PREPROD',
        env: {
          region: REGION,
          account: PREPROD_ACCOUNT,
        },
      }),
    );

    this.pipeline.addApplicationStage(
      new Stage(this, 'Prod', {
        recordName: 'api',
        environment: 'PROD',
        env: {
          region: REGION,
          account: PROD_ACCOUNT,
        },
      }),
    );
  }
}

const app = new cdk.App();
if (process.env.USER) {
  new ${projectType}Stack(app, \`\${process.env.USER}-${projectType}Dev\`, {
    env: {
      account: DEV_ACCOUNT,
      region: 'us-east-1',
    },
    environment: 'DEV',
  });
} else {
  new PipelineStack(app, '${projectType}Pipeline', {
    repo: '${projectName}',
    env: {
      region: REGION,
    },
  });
}
`;
  }

  private projectStackContents(projectName: string, projectType: string): string {
    return `import { Topic } from '@aws-cdk/aws-sns';
import { EmailSubscription } from '@aws-cdk/aws-sns-subscriptions';
import { Construct, Stack, StackProps } from '@aws-cdk/core';

export interface ${projectType}StackProps extends StackProps {
  environment: string;
}

const errorNotificationEmails = ['support@support.com'];

export class ${projectType}Stack extends Stack {
  constructor(scope: Construct, id: string, props?: ${projectType}StackProps) {
    super(scope, id, props);
    const STAGE = this.node.tryGetContext('STAGE');
    const errorNotificationTopic = new Topic(this, 'error-notification-topic', {
      displayName: \`${projectName}-error-notification-topic-\${STAGE}\`,
      topicName: \`${projectName}-error-notification-topic-\${STAGE}\`,
    });

    errorNotificationEmails.forEach(email => {
      errorNotificationTopic.addSubscription(new EmailSubscription(email));
    });
  }
}`;
  }

}