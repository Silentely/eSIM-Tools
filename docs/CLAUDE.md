[根目录](../CLAUDE.md) > **docs**

# 文档模块

## 模块职责

提供项目使用指南、安全指南和通知系统说明。

## 文档结构

| 目录 | 内容 | 文件格式 |
|------|------|----------|
| `guides/` | 使用指南 | Markdown |

## 核心文档

| 文档 | 路径 | 说明 | 受众 |
|------|------|------|------|
| **安全指南** | `SECURITY.md` | 安全措施说明 | 开发者 |
| **Giffgaff 教程** | `User_Guide.md` | 图文操作指南（含视频演示） | 普通用户 |
| **Giffgaff 英文教程** | `User_Guide_EN.md` | 英文版使用指南 | 普通用户 |
| **通知系统** | `guides/notification-system.md` | 通知功能说明 | 开发者 |

## 文档定位

### 用户文档
- **根 README.md / README_EN.md** - 面向普通用户
  - ✅ 功能介绍、使用流程、常见问题
  - ✅ 精简技术术语，强调用户价值
  - ✅ 引导开发者查看技术文档（如需要）

- **User_Guide.md / User_Guide_EN.md** - 图文教程
  - ✅ 详细操作步骤
  - ✅ 视频演示
  - ✅ 常见问题排查

### 开发者文档
- **SECURITY.md** - 安全指南
  - ✅ 安全措施说明
  - ✅ 安全最佳实践

- **guides/notification-system.md** - 通知系统
  - ✅ 通知功能实现说明

## 文档规范

- **语言**: 中文为主，英文版本并行维护
- **格式**: Markdown (CommonMark)
- **链接**: 使用相对路径（`./` 前缀），确保 GitHub 渲染正确
- **受众区分**:
  - 用户文档：简洁、直观、少技术术语
  - 开发者文档：详细、深入、包含实现说明

## 最近更新

**2026-01-13** - 文档结构精简
- ✅ 用户 README 精简技术细节（-74%）
- ✅ 修复中英文切换链接
- ✅ 移除冗余技术参考文档

## 相关文件清单

- `docs/CLAUDE.md` - 文档模块索引
- `docs/SECURITY.md` - 安全指南
- `docs/User_Guide.md` - Giffgaff 中文教程
- `docs/User_Guide_EN.md` - Giffgaff 英文教程
- `docs/guides/notification-system.md` - 通知系统说明

