# Bedrock Access Gateway (for Cursor)

Amazon Bedrock 用の OpenAI互換 RESTful API (for Cursor)

## Breaking Changes

ソースコードは、ツール呼び出しをネイティブにサポートするBedrockの新しい[Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html)で再構築されました。

問題が発生した場合は、Issueを作成してください。


## Overview
本 repository は [bedrock-access-gateway](https://github.com/aws-samples/bedrock-access-gateway) を forkし、Cursor用のFargate StackをCDKにより簡単に立ち上げられるようにしたものです。詳細は本家のリポジトリをご覧ください。

## Get Started
### Prerequisites

以下の前提条件を満たしていることを確認してください:

- Amazon Bedrock基盤モデルへのアクセス権限

> モデルアクセスの要求方法の詳細については、[Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) (Set Up > Model access)を参照してください。

### Architecture

以下の図は参照アーキテクチャを示しています。Application Load Balancer (ALB)用の2つのパブリックサブネットを持つ新しい**VPC**も含まれていることに注意してください。

![Architecture](assets/arch.svg)

ALBの背後に[AWS Fargate](https://aws.amazon.com/fargate/)を使用しています。

### Deployment

以下の手順に従って、Bedrock Proxy APIをAWSアカウントにデプロイしてください。Amazon Bedrockが利用可能なリージョン（例：`us-west-2`）でのみサポートされています。デプロイには約**3-5分**かかります🕒。
#### Step 1 : Parameter Storeに格納するAPI KEYやOptionの指定
`.env.example`をコピーして`.env`を作成し、`BedrockProxyAPIKey`を書き換えてください。
`random`と指定した場合は、randomの文字列が利用されます。

#### Step 2 : cdkによるdeploy
```bash
sh scripts/deploy.sh
```
これで完了です！🎉 デプロイが完了したら、CloudFormationスタックをクリックして出力タブに移動すると、`APIBaseUrl`からAPI Base URLを確認できます。値は`http://xxxx.xxx.elb.amazonaws.com/api/v1`のような形式になります。

### SDK/API Usage

必要なのはAPIキーとAPI Base URLだけです。独自のキーを設定しなかった場合は、デフォルトのAPIキーが作成されています。
`/bedrock-api/BedrockProxyAPIKey`を参照し、確認してください。

Cursor の設定は[こちら](https://zenn.dev/kobayasd/articles/ccf284b5b2ece5#cursor-%E3%81%AB%E3%82%A8%E3%83%B3%E3%83%89%E3%83%9D%E3%82%A4%E3%83%B3%E3%83%88%E3%82%92%E8%A8%AD%E5%AE%9A%E3%81%99%E3%82%8B)を参考に設定してください。

Cursorでは、bedrockを利用する際、モデルID に anthropic の名前がある場合にcursor 側でバリデーションckをしてからリクエストするようになります。そのため、`gpt-`から始まるダミーのモデルIDを入れていただき、DEFAULTモデルを利用する形になります。
DEFAULTでは`anthropic.claude-3-5-sonnet-20240620-v1:0`が利用されています。
モデルを変更したい場合は、ECSタスクの`DEFAULT_MODEL`を変更してください。

## Security
詳細については[CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)を参照してください。

## License
このライブラリはMIT-0ライセンスの下でライセンスされています。LICENSEファイルを参照してください。
