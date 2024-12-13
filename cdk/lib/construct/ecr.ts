import { RemovalPolicy } from 'aws-cdk-lib'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecrdeploy from 'cdk-ecr-deployment'
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets'
import * as path from "path";
import { Construct } from 'constructs'


interface ECRProps {
}

export class ecrRepository extends Construct {
  readonly repository: ecr.Repository

  constructor(scope: Construct, id: string, props: ECRProps) {
    super(scope, id)
    // ECR
    const LifecycleRule = {
      tagStatus: ecr.TagStatus.ANY,
      description: 'Delete more than 10 image',
      maxImageCount: 10,
    }
    this.repository = new ecr.Repository(scope, 'bedrock-proxy-api-ecs', {
      repositoryName: 'bedrock-proxy-api-ecs',
      removalPolicy: RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    })
    this.repository.addLifecycleRule(LifecycleRule)

    // Create Docker Image Asset
    const containerPath = path.join(__dirname, "../../../", "src")
    const excludeDir = ['node_modules','.git', 'cdk.out']
    const dockerImageAsset = new DockerImageAsset(this, "bedrock-proxy-api-ecs-asset", {
      directory: containerPath,
      file:"Dockerfile_cursor",
      exclude: excludeDir,
      platform: Platform.LINUX_AMD64,
    });

    // Deploy Docker Image to ECR Repository
    new ecrdeploy.ECRDeployment(this, "DeployFrontEndImage", {
      src: new ecrdeploy.DockerImageName(dockerImageAsset.imageUri),
      dest: new ecrdeploy.DockerImageName(this.repository.repositoryUri)
    });


  }
}
