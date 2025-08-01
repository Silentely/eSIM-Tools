#!/bin/bash

# eSIM工具自动部署脚本

echo "🚀 开始部署eSIM工具..."

# 检查是否在正确的目录
if [ ! -f "netlify.toml" ]; then
    echo "❌ 错误: 未找到netlify.toml文件，请确保在项目根目录运行此脚本"
    exit 1
fi

# 检查Git是否初始化
if [ ! -d ".git" ]; then
    echo "📦 初始化Git仓库..."
    git init
    git add .
    git commit -m "Initial commit: eSIM Tools with Netlify deployment"
    
    echo "📋 请设置远程仓库:"
    echo "   git remote add origin https://github.com/your-username/esim-tools.git"
    echo "   git push -u origin main"
    echo ""
    echo "然后在Netlify中连接此仓库进行自动部署"
else
    echo "📦 更新Git仓库..."
    git add .
    
    # 检查是否有变更
    if git diff --cached --quiet; then
        echo "ℹ️  没有文件变更，跳过提交"
    else
        echo "请输入提交信息 (默认: Update eSIM tools):"
        read -r commit_message
        commit_message=${commit_message:-"Update eSIM tools"}
        
        git commit -m "$commit_message"
        
        # 推送到远程仓库
        if git remote get-url origin > /dev/null 2>&1; then
            echo "📤 推送到远程仓库..."
            git push
        else
            echo "⚠️  未设置远程仓库，请手动设置:"
            echo "   git remote add origin https://github.com/your-username/esim-tools.git"
            echo "   git push -u origin main"
        fi
    fi
fi

echo ""
echo "✅ 部署准备完成！"
echo ""
echo "📋 Netlify部署步骤:"
echo "1. 登录 https://app.netlify.com"
echo "2. 点击 'New site from Git'"
echo "3. 选择您的Git仓库"
echo "4. 构建设置:"
echo "   - Build command: echo 'No build needed'"
echo "   - Publish directory: ."
echo "5. 点击 'Deploy site'"
echo ""
echo "🌐 域名配置:"
echo "- 在Netlify站点设置中添加自定义域名: esim.yyxx.com"
echo "- 配置DNS记录指向Netlify"
echo ""
echo "🔗 访问路径:"
echo "- 主页: https://esim.yyxx.com/"
echo "- Giffgaff工具: https://esim.yyxx.com/giffgaff"
echo "- Simyo工具: https://esim.yyxx.com/simyo"
echo ""
echo "📚 更多信息请参考 DEPLOYMENT_GUIDE.md"