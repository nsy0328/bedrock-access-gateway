#!/bin/bash

# スクリプトの場所を基準にしてプロジェクトルートのパスを設定
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
# プロジェクトルートに移動
cd "$PROJECT_ROOT"

# .envファイルが存在する場合、その内容を読み込む
if [ -f .env ]; then
    source .env
fi

# BedrockProxyAPIKeyの設定
# .envファイルで設定されていない場合はデフォルト値を使用
BedrockProxyAPIKey=${BedrockProxyAPIKey:-random}

# BedrockProxyAPIKeyが"random"の場合、新しいキーを生成
if [ "${BedrockProxyAPIKey}" = "random" ]; then
    BedrockProxyAPIKey=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | cut -c1-32)
fi

# API_KEY_PARAM_NAMEの設定
# .envファイルで設定されていない場合はデフォルト値を使用
API_KEY_PARAM_NAME=${API_KEY_PARAM_NAME:-"/bedrock-api/BedrockProxyAPIKey"}

# SSM Parameter Storeにパラメータを作成
aws ssm put-parameter \
    --name "${API_KEY_PARAM_NAME}" \
    --value "${BedrockProxyAPIKey}" \
    --type "SecureString" \
    --overwrite


# CDKのデプロイ
cd cdk
npm install
cdk deploy --require-approval never