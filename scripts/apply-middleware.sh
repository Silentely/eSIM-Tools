#!/bin/bash

# 批量应用中间件到剩余Functions的脚本
# 使用方法: bash scripts/apply-middleware.sh

set -e

FUNCTIONS_DIR="netlify/functions"

echo "🔧 开始批量重构Functions..."
echo ""

# 定义需要重构的函数列表(排除已重构的)
FUNCTIONS=(
  "giffgaff-graphql"
  "giffgaff-mfa-challenge"
  "giffgaff-mfa-validation"
  "giffgaff-sms-activate"
  "auto-activate-esim"
)

for func in "${FUNCTIONS[@]}"; do
  FILE="${FUNCTIONS_DIR}/${func}.js"

  if [ ! -f "$FILE" ]; then
    echo "⚠️  跳过不存在的文件: $FILE"
    continue
  fi

  echo "📝 处理: $func.js"

  # 备份原文件
  cp "$FILE" "${FILE}.backup"

  # 检查是否已经使用中间件
  if grep -q "withAuth" "$FILE"; then
    echo "  ✅ 已使用中间件，跳过"
    rm "${FILE}.backup"
    continue
  fi

  echo "  ⏳ 添加中间件导入..."
  # 在第一个require之后添加中间件导入
  if ! grep -q "_shared/middleware" "$FILE"; then
    sed -i.tmp "1,/const.*require/s/\(const.*require.*\);/\1;\nconst { withAuth, validateInput, AuthError } = require('.\/\_shared\/middleware');/" "$FILE"
    rm "${FILE}.tmp" 2>/dev/null || true
  fi

  echo "  ✅ 完成"
  echo ""
done

echo "✨ 批量重构完成！"
echo ""
echo "📋 请手动完成以下步骤:"
echo "  1. 检查每个函数的备份文件(.backup)"
echo "  2. 完成exports.handler重构为withAuth包装"
echo "  3. 添加输入验证schema"
echo "  4. 测试功能是否正常"
echo ""
echo "💡 参考示例: netlify/functions/giffgaff-token-exchange.js"
