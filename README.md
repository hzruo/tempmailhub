# TempMailHub

<div align="center">

**🌟 一个现代化的跨平台临时邮件网关服务 🌟**

基于 Hono 框架构建的多平台临时邮箱 API 聚合服务

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hzruo/tempmailhub)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hzruo/tempmailhub)
[![Deploy on Deno](https://deno.com/button)](https://app.deno.com/new?clone=https://github.com/hzruo/tempmailhub)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/hzruo/tempmailhub)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)
![Hono](https://img.shields.io/badge/Hono-4.6+-orange.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-green.svg)

</div>

## 🌟 功能特性

- 🔗 **多服务商聚合**: 集成 MinMail、TempMail Plus、Mail.tm、EtempMail、VanishPost、ChatTempMail 等多个临时邮箱服务
- 🌍 **多平台部署**: 支持 Cloudflare Workers、Deno、Vercel、Node.js 等多种部署平台
- 🔐 **双层认证**: TempMailHub API Key + Provider AccessToken 保障安全
- 🔄 **智能重试**: 内置重试机制和错误处理
- 📊 **健康监控**: 实时监控各渠道状态和统计信息
- 🛡️ **类型安全**: 完整的 TypeScript 类型定义
- 🐳 **容器化**: 支持 Docker 部署和 GitHub Actions 自动构建

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/hzruo/tempmailhub.git
cd tempmailhub

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问服务
open http://localhost:8787
```

### 一键部署

点击上方任意部署按钮，即可一键部署到对应平台。

## 📖 文档

| 文档 | 内容 |
|------|------|
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | 📚 **完整API文档** - 接口说明、使用示例、测试方法 |
| [API_SECURITY.md](./API_SECURITY.md) | 🔐 **安全配置** - API Key 认证详细配置 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚀 **部署指南** - 多平台部署详细说明 |

## 🎯 支持的服务商

| 服务商 | 域名数量 | 需要 AccessToken | 域名自定义 | 特性 |
|-------|---------|----------------|-----------|------|
| **ChatTempMail** | 多个 | ✅ | ✅ | AI驱动的临时邮箱服务、自定义过期时间 |
| **MinMail** | 1个 | ❌ | ❌ | 自动过期、高可用 |
| **TempMail Plus** | 9个 | ❌ | ✅ | 最多域名选择 |
| **Mail.tm** | 1个 | ✅ | ❌ | 创建时返回 accessToken |
| **EtempMail** | 4个 | ❌ | ✅ | 教育域名 |
| **VanishPost** | 动态 | ❌ | ❌ | 15分钟自动过期 |

## 📋 基本 API 使用

### 1. 创建邮箱

```bash
curl -X POST http://localhost:8787/api/mail/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"provider": "mailtm"}'
```

### 2. 获取邮件

```bash
curl -X POST http://localhost:8787/api/mail/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "address": "user@somoj.com",
    "accessToken": "provider_token"
  }'
```

> 💡 **详细使用说明**: 请查看 [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)  
> 🚀 **部署指南**: 请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🏗️ 项目架构

```
TempMailHub/
├── src/
│   ├── providers/         # 邮件服务商适配器
│   ├── services/          # 业务逻辑层
│   ├── middleware/        # 认证中间件
│   ├── types/             # TypeScript 类型定义
│   └── index.ts           # 应用入口
├── API_DOCUMENTATION.md   # 完整API文档
├── API_SECURITY.md        # 安全配置文档
├── DEPLOYMENT.md          # 部署指南
└── README.md              # 项目说明
```

## 🔧 开发

### 添加新服务商

1. 在 `src/providers/` 创建适配器文件
2. 实现 `IMailProvider` 接口
3. 在 `src/providers/index.ts` 注册服务商

### 构建和测试

```bash
# 构建
npm run build

# 测试
npm test
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## ⚠️ 免责声明

本项目 **TempMailHub** 仅供**学习、研究和测试**目的使用。请用户遵守以下条款：

### 使用限制

- ❌ **禁止用于任何非法、违规或恶意活动**
- ❌ **禁止用于垃圾邮件发送或网络攻击**
- ❌ **禁止用于绕过任何服务的正当验证机制**
- ❌ **禁止用于任何可能损害第三方利益的行为**

### 责任声明

- 🔸 本项目**不存储**任何用户邮件内容或个人信息
- 🔸 本项目仅作为**API聚合器**，不对第三方服务的可用性负责
- 🔸 使用本服务造成的任何后果由**用户自行承担**
- 🔸 开发者**不承担**因使用本项目而产生的任何法律责任

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

## 🙏 致谢

### 技术框架
- [Hono](https://hono.dev/) - 轻量级 Web 框架

### 临时邮箱服务提供商
本项目感谢以下优秀的临时邮箱服务提供商：

- [ChatTempMail](https://chat-tempmail.com/) - AI驱动的临时邮箱服务、自定义过期时间的临时邮箱服务
- [MinMail](https://minmail.app/) - 自动过期、高可用的临时邮箱服务
- [TempMail Plus](https://tempmail.plus/) - 支持多域名选择的临时邮箱服务  
- [Mail.tm](https://mail.tm/) - 稳定可靠的临时邮箱API服务
- [EtempMail](https://etempmail.com/) - 提供教育域名的临时邮箱服务
- [VanishPost](https://vanishpost.com/) - 15分钟自动过期的临时邮箱服务

> **⚠️ 重要说明**: 
> 
> 本项目 **TempMailHub** 仅提供 **API 聚合服务**，不提供 Web UI 界面。
> 
> 如需**图形界面体验**，请直接访问上述各临时邮箱提供方的官方网站～

---

<div align="center">

**如果这个项目对您有帮助，请给我们一个 ⭐**

Made with ❤️ by [TempMailHub Contributors](https://github.com/hzruo/tempmailhub/contributors)

</div>