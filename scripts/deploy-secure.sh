#!/bin/bash

# 安全部署脚本
# 确保所有安全措施就位后再部署

set -e  # 遇到错误立即退出

echo "🔒 开始安全部署流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1 失败${NC}"
        exit 1
    fi
}

# 1. 环境检查
echo -e "${BLUE}📋 步骤 1: 环境检查${NC}"

# 检查Node.js版本
node_version=$(node -v | cut -d'v' -f2)
required_version="18.0.0"
if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo -e "${RED}❌ Node.js版本过低，需要 >= $required_version${NC}"
    exit 1
fi
check_step "Node.js版本检查 ($node_version)"

# 检查必要文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env文件不存在，将从env.example创建${NC}"
    cp env.example .env
    echo -e "${RED}❌ 请编辑 .env 文件并填入真实的环境变量${NC}"
    exit 1
fi
check_step ".env文件存在"

# 2. 安全检查
echo -e "${BLUE}🔐 步骤 2: 安全检查${NC}"

# 检查环境变量
if grep -q "your_.*_here" .env; then
    echo -e "${RED}❌ .env文件包含默认值，请填入真实的环境变量${NC}"
    grep "your_.*_here" .env
    exit 1
fi
check_step "环境变量配置检查"

# 检查敏感文件是否被正确忽略
if git check-ignore .env >/dev/null 2>&1; then
    check_step ".env文件已被Git忽略"
else
    echo -e "${RED}❌ .env文件未被Git忽略，存在泄露风险${NC}"
    exit 1
fi

# 3. 依赖安全检查
echo -e "${BLUE}📦 步骤 3: 依赖安全检查${NC}"

# 安装依赖
npm ci --only=production
check_step "生产依赖安装"

# 安全审计
npm audit --audit-level moderate
check_step "依赖安全审计"

# 4. 代码质量检查
echo -e "${BLUE}🔍 步骤 4: 代码质量检查${NC}"

# 检查安全文件是否存在
security_files=(
    "src/secure/auth-service.js"
    "src/secure/giffgaff-secured.html"
    "src/secure/anti-scraping.js"
    "netlify/functions/secure-giffgaff-oauth.js"
    "netlify/functions/secure-simyo-auth.js"
)

for file in "${security_files[@]}"; do
    if [ -f "$file" ]; then
        check_step "安全文件存在: $file"
    else
        echo -e "${RED}❌ 缺少安全文件: $file${NC}"
        exit 1
    fi
done

# 5. 配置验证
echo -e "${BLUE}⚙️  步骤 5: 配置验证${NC}"

# 检查netlify.toml配置
if grep -q "src/secure/giffgaff-secured.html" netlify.toml; then
    check_step "Netlify配置指向安全版本"
else
    echo -e "${RED}❌ Netlify配置未指向安全版本${NC}"
    exit 1
fi

# 检查安全头部配置
if grep -q "Strict-Transport-Security" netlify.toml; then
    check_step "安全头部配置存在"
else
    echo -e "${RED}❌ 缺少安全头部配置${NC}"
    exit 1
fi

# 6. 构建测试
echo -e "${BLUE}🏗️  步骤 6: 构建测试${NC}"

# 运行构建命令
npm run build
check_step "构建测试"

# 7. 部署前确认
echo -e "${BLUE}🚀 步骤 7: 部署确认${NC}"

echo -e "${YELLOW}请确认以下信息:${NC}"
echo "- 所有环境变量已正确配置"
echo "- 安全功能已启用"
echo "- 敏感信息已从代码中移除"
echo "- 防护机制已激活"

read -p "确认部署到生产环境? (y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo -e "${YELLOW}部署已取消${NC}"
    exit 0
fi

# 8. 执行部署
echo -e "${BLUE}🌐 步骤 8: 执行部署${NC}"

# 检查Netlify CLI
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}❌ Netlify CLI未安装${NC}"
    echo "请运行: npm install -g netlify-cli"
    exit 1
fi

# 部署到生产环境
netlify deploy --prod --dir . --functions netlify/functions
check_step "生产环境部署"

# 9. 部署后验证
echo -e "${BLUE}✅ 步骤 9: 部署后验证${NC}"

echo -e "${GREEN}🎉 安全部署完成！${NC}"
echo ""
echo -e "${BLUE}部署后检查清单:${NC}"
echo "□ 访问网站确认安全页面正常加载"
echo "□ 测试OAuth流程是否正常工作"
echo "□ 验证开发者工具是否被正确阻止"
echo "□ 检查网络请求是否通过安全端点"
echo "□ 确认敏感信息未在前端暴露"
echo ""
echo -e "${YELLOW}⚠️  重要提醒:${NC}"
echo "- 定期更新环境变量"
echo "- 监控安全日志"
echo "- 及时更新依赖包"
echo "- 定期进行安全审计"
echo ""
echo -e "${GREEN}部署URL: https://your-domain.com${NC}"