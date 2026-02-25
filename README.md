# LinkSoul

LinkSoul 是一个以 AI 驱动的社交连接平台，包含移动端、后端 API、管理后台与 AI 服务。  
本仓库为 `pnpm workspace + Turborepo` 的 monorepo。

## 项目结构

```text
linksoul/
├─ apps/
│  ├─ mobile/    # Expo + React Native 客户端
│  ├─ backend/   # NestJS + Prisma API 服务
│  └─ admin/     # React + Vite 管理后台
├─ ai-services/  # Python AI 服务（可选）
├─ scripts/      # 本地开发辅助脚本
└─ infrastructure/
```

## 技术栈

- **移动端**: Expo 54, React Native, Expo Router, Zustand
- **后端**: NestJS 11, Prisma, Redis, Swagger
- **管理后台**: React 19, Vite
- **AI 服务**: FastAPI / Uvicorn（可选）
- **Monorepo**: pnpm workspace, Turbo

## 功能概览

- 用户资料、性格测试、信用分与签到
- 推荐匹配、关系管理、互动（喜欢/共振/跳过）
- 脉冲动态（多图/多视频、音乐/位置/链接、投票）
- 评论、点赞、媒体查看器
- 举报、拉黑与后台风控限流

## 环境要求

- Node.js `>= 22`
- pnpm `>= 10`
- Python `>= 3.10`（仅 AI 服务需要）
- Redis（推荐本地启动）

> 当前 Prisma schema 使用 `sqlite`。请确保 `DATABASE_URL` 与实际数据库类型一致。

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 配置环境变量

复制根目录环境变量模板：

```bash
cp .env.example .env
```

如果你使用 SQLite（与当前 schema 一致），可将 `DATABASE_URL` 配为：

```env
DATABASE_URL="file:./apps/backend/prisma/dev.db"
```

> `.env.example` 里部分示例值（如 PostgreSQL）仅为模板，不代表当前默认实现。

### 3) 初始化数据库（后端）

```bash
pnpm --filter @linksoul/backend prisma:generate
pnpm --filter @linksoul/backend prisma:migrate
```

### 4) 启动服务

```bash
# 后端 API (http://localhost:3000)
pnpm dev:backend

# 移动端 Expo
pnpm dev:mobile

# 管理后台 (http://localhost:5173)
pnpm dev:admin

# AI 服务（可选）
pnpm dev:ai
```

## 常用命令

```bash
# 构建
pnpm build:backend
pnpm build:admin
pnpm build:mobile

# 代码检查
pnpm lint

# 数据库
pnpm db:migrate
pnpm db:seed
```

## 生产部署（腾讯云）

- 自动化部署文档：`DEPLOY_TENCENT_CVM_WECHAT.md`
- 一键初始化（服务器首次）：`pnpm deploy:bootstrap:cvm`
- 日常发布：`pnpm deploy:cvm`
- 生产容器编排：`pnpm docker:prod`
- 默认目录化路由（单域名）：`/linksoul/api/v1`、`/linksoul/admin`、`/linksoul/mobile`

## API 与联调

- 后端基础地址：`http://localhost:3000/api/v1`
- Swagger 文档：`http://localhost:3000/api/docs`
- 移动端默认读取：`EXPO_PUBLIC_API_URL`

真机调试时，不要使用 `localhost`，请改为你的局域网 IP，例如：

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
```

## 管理后台说明

- 开发端口：`5173`
- 已配置代理：`/api -> http://localhost:3000`
- 管理端 API 前缀：`/api/v1`

## 上传 GitHub 前检查

- 不要提交真实密钥：`.env`、私钥、第三方 token
- 检查移动端 API 地址是否为可公开的配置方式
- 确认数据库文件是否需要纳入版本控制（通常不提交本地 sqlite 数据文件）
- 建议补充仓库 License（如 MIT）与贡献指南

## 版本说明

当前仓库处于快速迭代阶段，接口与页面可能持续调整。  
如需稳定发布，建议基于 tag 或 release 分支进行部署。

