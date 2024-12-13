import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { ecrRepository } from './construct/ecr';
import * as dotenv from 'dotenv';
import * as path from 'path';

export class BedrockProxyFargateCDKStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // .envファイルを読み込む
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });

    // SecureStringパラメータの作成はShellScriptで /bedrock-api/BedrockProxyAPIKey に
    // ECR
    const { repository } = new ecrRepository(this, 'cursorImageRepository', {})

    // VPCの作成
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      cidr: '10.250.0.0/16',
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
    });
    
    // ECSクラスターの作成
    const cluster = new ecs.Cluster(this, 'ProxyBedrockCluster', {
      vpc: vpc,
      enableFargateCapacityProviders: true,
    });

    // タスク実行ロールの作成
    const executionRole = new iam.Role(this, 'ProxyExecRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    executionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*'],
    }));

    // タスクロールの作成
    const taskRole = new iam.Role(this, 'ProxyTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
        'bedrock:GetInferenceProfile',
        'bedrock:ListInferenceProfiles'
      ],
      resources: [
        'arn:aws:bedrock:*::foundation-model/*',
        'arn:aws:bedrock:*:*:inference-profile/*'
      ],
    }));

    taskRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath'
      ],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/bedrock-api/BedrockProxyAPIKey`
      ]
    }));

    // タスク定義の作成
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ProxyTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      executionRole: executionRole,
      taskRole: taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // コンテナの追加
    const ecsLogGroup = new logs.LogGroup(this, 'cursor-gateway-logs', {
      logGroupName: 'cursor-gateway-logs',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const container = taskDefinition.addContainer('proxy-api', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      containerName:'cursor-gateway',
      environment: {
        'API_KEY_PARAM_NAME': process.env.API_KEY_PARAM_NAME || '/bedrock-api/BedrockProxyAPIKey',
        'DEBUG': process.env.DEBUG || 'false',
        'DEFAULT_MODEL': process.env.DEFAULT_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        'DEFAULT_EMBEDDING_MODEL': process.env.DEFAULT_EMBEDDING_MODEL || 'cohere.embed-multilingual-v3',
        'DEFAULT_MAX_TOKENS': process.env.DEFAULT_MAX_TOKENS || '2048',
      },
      portMappings: [{ containerPort: 80 }],
      logging: ecs.LogDriver.awsLogs({ streamPrefix: 'cursor-gateway-logs', logGroup: ecsLogGroup}),
    });
    container.node.addDependency(repository);

    // ALBの作成
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ProxyALB', {
      loadBalancerName: 'bedrock-cursor-proxy',
      vpc,
      internetFacing: true,
    });

    // ターゲットグループの作成
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'ProxyALBListenerTargetsGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
      },
    });

    // リスナーの追加
    const listener = alb.addListener('ProxyALBListener', {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    // Fargateサービスの作成
    const service = new ecs.FargateService(this, 'ProxyApiService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
      ],
    });

    service.attachToApplicationTargetGroup(targetGroup);

    // 出力の追加
    new cdk.CfnOutput(this, 'APIBaseUrl', {
      description: 'Proxy API Base URL (OPENAI_API_BASE)',
      value: `http://${alb.loadBalancerDnsName}/api/v1`,
    });
  }
}