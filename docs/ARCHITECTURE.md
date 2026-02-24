# LinkSoul App 技术架构设计文档

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        客户端 (Client Layer)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  iOS App      │  │ Android App  │  │   Web App    │              │
│  │  (Expo/RN)    │  │  (Expo/RN)   │  │  (Next.js)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API 网关 (API Gateway)                          │
│              Kong / AWS API Gateway / Traefik                        │
│         ┌─────────────────────────────────┐                         │
│         │  认证 · 限流 · 路由 · 日志 · CORS  │                        │
│         └─────────────────────────────────┘                         │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  用户服务     │ │  匹配服务     │ │   聊天服务    │
│  User Svc    │ │  Match Svc   │ │   Chat Svc   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  关系服务     │ │  信用服务     │ │   AI 服务     │
│ Relation Svc │ │  Credit Svc  │ │   AI Svc     │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       数据层 (Data Layer)                            │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ PostgreSQL │ │  Redis   │ │  Milvus  │ │  MinIO/OSS       │    │
│  │ (主数据库)  │ │ (缓存)   │ │ (向量库) │ │  (对象存储)       │    │
│  └────────────┘ └──────────┘ └──────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、技术选型

### 2.1 前端 / 移动端

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| 跨平台框架 | **React Native + Expo** | Expo SDK 52+ | 一套代码覆盖 iOS/Android/Web，生态成熟，热更新支持 |
| Web 端 | **Next.js 15** | 15.x (App Router) | React 服务端渲染，SEO 友好，支持 RSC |
| UI 组件库 | **Tamagui** | 1.x | 跨平台 UI 组件，支持 RN + Web，高性能 |
| 状态管理 | **Zustand** | 5.x | 轻量、TypeScript 友好、无 boilerplate |
| 网络请求 | **TanStack Query** | 5.x | 缓存、重试、乐观更新、离线支持 |
| 实时通信 | **Socket.io Client** | 4.x | WebSocket 封装，自动重连，房间管理 |
| 导航 | **Expo Router** | 4.x | 文件系统路由，Deep Linking 支持 |
| 表单 | **React Hook Form + Zod** | - | 高性能表单验证 |
| 语言 | **TypeScript** | 5.x | 类型安全，提升代码质量 |

### 2.2 后端服务

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| 主框架 | **NestJS** | 11.x | TypeScript 原生支持，模块化架构，微服务友好 |
| 运行时 | **Node.js** | 22 LTS | 长期支持版，性能优秀 |
| API 协议 | **REST + GraphQL** | - | REST 用于标准 CRUD，GraphQL 用于复杂查询 |
| GraphQL | **Apollo Server** | 4.x | 成熟的 GraphQL 实现 |
| ORM | **Prisma** | 6.x | 类型安全 ORM，迁移管理，查询优化 |
| 实时通信 | **Socket.io** | 4.x | 聊天功能的实时双向通信 |
| 任务队列 | **BullMQ** | 5.x | 基于 Redis，支持延迟任务、重试、优先级 |
| 认证 | **JWT + OAuth2** | - | 无状态认证 + 第三方登录 |
| API 文档 | **Swagger/OpenAPI** | 3.x | 自动生成 API 文档 |

### 2.3 AI 服务层

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| AI 框架 | **Python + FastAPI** | 3.12+ / 0.115+ | Python AI 生态最佳，FastAPI 高性能异步 |
| LLM 编排 | **LangChain / LangGraph** | 0.3+ | Agent 工作流编排，支持多模型切换 |
| LLM 提供商 | **DeepSeek (deepseek-chat / deepseek-reasoner)** | V3/R1 | 高性价比国产大模型，兼容 OpenAI API 协议，中文能力强 |
| 向量数据库 | **Milvus** | 2.4+ | 开源向量数据库，支持大规模相似度检索 |
| 情绪分析 | **自训练模型 + HuggingFace** | - | 基于 Transformer 的情绪识别 |
| ML 框架 | **PyTorch** | 2.x | 关系预测、行为分析自训练模型 |
| 模型服务 | **vLLM / Triton** | - | 高性能模型推理服务 |

#### DeepSeek 模型说明

| 模型 | 用途 | 特点 |
|------|------|------|
| **deepseek-chat (V3)** | 日常对话、聊天建议、情绪分析、内容生成 | 高速响应，中文理解力强，性价比极高 |
| **deepseek-reasoner (R1)** | 关系阶段推理、匹配算法决策、复杂分析 | 深度推理能力，适合需要逻辑链的场景 |

- **API 端点**: `https://api.deepseek.com`
- **协议**: 兼容 OpenAI API 协议，可直接使用 `openai` SDK
- **优势**: 中文语义理解出色、价格约为 GPT-4o 的 1/10、支持 64K 上下文

### 2.4 数据层

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| 关系型数据库 | **PostgreSQL** | 17 | 用户、关系、信用等结构化数据 |
| 缓存 | **Redis Stack** | 7.4+ | 缓存 + 实时排行 + 会话管理 + 搜索 |
| 向量数据库 | **Milvus** | 2.4+ | 用户画像向量、匹配检索 |
| 消息队列 | **Redis Streams / Kafka** | - | 聊天消息持久化与异步处理 |
| 对象存储 | **MinIO / 阿里云 OSS** | - | 用户头像、聊天图片等文件存储 |
| 搜索引擎 | **Elasticsearch** | 8.x | 用户搜索、聊天记录全文检索 |

### 2.5 基础设施

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| 容器化 | **Docker** | 标准容器化部署 |
| 编排 | **Kubernetes (K8s)** | 自动扩缩容、服务发现、滚动更新 |
| CI/CD | **GitHub Actions** | 自动化测试、构建、部署流水线 |
| 监控 | **Prometheus + Grafana** | 指标监控与可视化告警 |
| 日志 | **ELK Stack (Elasticsearch + Logstash + Kibana)** | 集中式日志管理 |
| APM | **OpenTelemetry** | 分布式链路追踪 |
| CDN | **Cloudflare / 阿里云 CDN** | 静态资源加速 |
| DNS/域名 | **Cloudflare** | DNS 管理、DDoS 防护 |

---

## 三、微服务架构详细设计

### 3.1 服务划分

```
linksoul-backend/
├── apps/
│   ├── api-gateway/          # API 网关服务
│   ├── user-service/         # 用户服务 (注册/登录/资料/性格测试)
│   ├── match-service/        # 匹配服务 (AI匹配算法/推荐)
│   ├── chat-service/         # 聊天服务 (实时消息/AI预聊天)
│   ├── relation-service/     # 关系服务 (关系阶段/进展追踪)
│   ├── credit-service/       # 信用服务 (行为评分/信誉记录)
│   ├── ai-service/           # AI 服务 (LLM编排/情绪分析/建议生成)
│   ├── notification-service/ # 通知服务 (推送/短信/邮件)
│   └── admin-service/        # 管理后台服务
├── libs/
│   ├── shared/               # 共享类型、工具函数
│   ├── database/             # 数据库模型、Prisma Schema
│   └── auth/                 # 认证相关共享逻辑
├── docker-compose.yml
├── k8s/                      # Kubernetes 部署配置
└── .github/workflows/        # CI/CD 流水线
```

### 3.2 各服务职责

#### User Service (用户服务)
- 用户注册/登录 (手机号 + 短信验证码 / 微信 / Apple)
- 用户资料管理 (基础信息、头像、相册)
- 性格测试与心理建模 (依恋类型、价值观评估)
- AI 用户画像生成

#### Match Service (匹配服务)
- 基于价值观、依恋类型、沟通方式的多维匹配算法
- 每日推荐列表生成
- 匹配度评分与解释
- 向量相似度检索

#### Chat Service (聊天服务)
- 实时 WebSocket 聊天
- AI 预聊天机制 (双方 AI 先进行兼容性测试)
- 聊天截图分析
- AI 回复建议生成
- 消息已读/未读、撤回

#### Relation Service (关系服务)
- 关系阶段管理 (初识 → 了解 → 约会 → 确定关系)
- 关系进展追踪与记录
- AI 关系推进建议
- 阶段性报告生成

#### Credit Service (信用服务)
- 用户行为评分算法
- 信誉记录与等级
- 异常行为检测 (骚扰/诈骗)
- 举报处理

#### AI Service (AI 核心服务)
- LLM 对话编排 (AI 关系分身)
- 情绪识别与分析
- 聊天风格学习
- 关系阶段预测
- 个性化策略生成

---

## 四、数据库设计概览

### 4.1 PostgreSQL 核心表

```sql
-- 用户表
users (id, phone, email, nickname, avatar, gender, birth_date, 
       bio, location, status, created_at, updated_at)

-- 心理画像表
user_profiles (id, user_id, attachment_type, values_vector,
               communication_style, personality_tags, ai_summary)

-- 匹配记录表
matches (id, user_a_id, user_b_id, score, match_reason, 
         status, created_at)

-- 聊天会话表
conversations (id, match_id, type, status, created_at)

-- 聊天消息表
messages (id, conversation_id, sender_id, content, type,
          ai_suggested, read_at, created_at)

-- 关系阶段表
relationships (id, match_id, stage, started_at, 
               ai_assessment, progress_score)

-- 信用记录表
credit_scores (id, user_id, score, level, updated_at)

-- 信用行为日志
credit_logs (id, user_id, action_type, score_change, 
             reason, created_at)
```

### 4.2 Redis 缓存策略

```
user:session:{userId}     → 用户会话信息 (TTL: 7d)
user:profile:{userId}     → 用户画像缓存 (TTL: 1h)
match:daily:{userId}      → 每日推荐缓存 (TTL: 24h)
chat:online:{userId}      → 在线状态 (TTL: 5min, 心跳续期)
chat:typing:{conversationId} → 正在输入状态 (TTL: 3s)
credit:score:{userId}     → 信用分缓存 (TTL: 30min)
```

### 4.3 Milvus 向量索引

```
Collection: user_embeddings
  - user_id:      Int64
  - profile_vec:  FloatVector(768)  // 用户画像向量
  - values_vec:   FloatVector(256)  // 价值观向量
  - style_vec:    FloatVector(256)  // 沟通风格向量
Index: IVF_FLAT, nlist=1024
```

---

## 五、AI 架构设计

### 5.1 AI 能力分层

```
┌─────────────────────────────────────────────────┐
│              应用层 (Application)                 │
│  聊天建议 · 匹配推荐 · 关系分析 · 情绪洞察        │
├─────────────────────────────────────────────────┤
│              编排层 (Orchestration)               │
│         LangGraph Agent Workflow                 │
│  ┌─────────┐ ┌──────────┐ ┌─────────────┐      │
│  │ 聊天Agent│ │ 分析Agent │ │ 推荐Agent   │      │
│  └─────────┘ └──────────┘ └─────────────┘      │
├─────────────────────────────────────────────────┤
│              模型层 (Model)                       │
│  ┌──────────┐ ┌───────────┐ ┌───────────────┐  │
│  │DeepSeek  │ │ 情绪识别   │ │ 关系预测模型  │   │
│  │ V3 / R1  │ │ 微调模型   │ │ (PyTorch)    │   │
│  └──────────┘ └───────────┘ └───────────────┘  │
├─────────────────────────────────────────────────┤
│              数据层 (Data)                        │
│  向量存储 · 对话历史 · 用户画像 · 行为日志         │
└─────────────────────────────────────────────────┘
```

### 5.2 AI Agent 工作流

```
用户发送消息
    │
    ▼
[情绪识别] → 识别当前情绪状态
    │
    ▼
[上下文构建] → 加载对话历史 + 用户画像 + 关系阶段
    │
    ▼
[策略选择] → 根据关系阶段选择沟通策略
    │
    ▼
[回复生成] → LLM 生成多条候选回复
    │
    ▼
[安全过滤] → 内容审核 + 合规检查
    │
    ▼
[呈现建议] → 返回给用户选择
```

---

## 六、安全与隐私设计

### 6.1 数据安全

- **传输加密**: 全链路 TLS 1.3
- **存储加密**: 数据库字段级 AES-256 加密 (手机号、身份证等)
- **密钥管理**: HashiCorp Vault / 云 KMS
- **访问控制**: RBAC 基于角色的权限控制

### 6.2 隐私合规 (GDPR)

- 数据最小化原则
- 用户数据导出 / 删除接口
- 明确的隐私政策与用户同意
- 数据处理日志审计
- 聊天数据端到端加密选项

### 6.3 安全防护

- **WAF**: Web 应用防火墙
- **Rate Limiting**: API 限流防刷
- **CAPTCHA**: 注册/登录验证码
- **内容审核**: AI + 人工双重审核机制
- **举报系统**: 用户行为举报与处理流程

---

## 七、项目目录结构

```
linksoul/
├── apps/
│   ├── mobile/                    # React Native (Expo) 移动端
│   │   ├── app/                   # Expo Router 页面
│   │   │   ├── (auth)/            # 认证相关页面
│   │   │   ├── (tabs)/            # 主 Tab 页面
│   │   │   │   ├── home/          # 首页/每日推荐
│   │   │   │   ├── discover/      # 发现/匹配
│   │   │   │   ├── chat/          # 聊天列表
│   │   │   │   ├── relations/     # 关系管理
│   │   │   │   └── profile/       # 个人中心
│   │   │   └── _layout.tsx
│   │   ├── components/            # 共享组件
│   │   ├── hooks/                 # 自定义 Hooks
│   │   ├── stores/                # Zustand 状态
│   │   ├── services/              # API 服务层
│   │   ├── utils/                 # 工具函数
│   │   └── assets/                # 静态资源
│   │
│   ├── web/                       # Next.js Web 端
│   │   ├── app/                   # App Router
│   │   ├── components/
│   │   └── ...
│   │
│   └── backend/                   # NestJS 后端 (Monorepo)
│       ├── apps/
│       │   ├── api-gateway/
│       │   ├── user-service/
│       │   ├── match-service/
│       │   ├── chat-service/
│       │   ├── relation-service/
│       │   ├── credit-service/
│       │   └── notification-service/
│       ├── libs/
│       │   ├── shared/
│       │   ├── database/
│       │   └── auth/
│       └── prisma/
│           └── schema.prisma
│
├── ai-services/                   # Python AI 服务
│   ├── app/
│   │   ├── agents/                # LangGraph Agents
│   │   │   ├── chat_agent.py      # 聊天建议 Agent
│   │   │   ├── match_agent.py     # 匹配分析 Agent
│   │   │   └── relation_agent.py  # 关系推进 Agent
│   │   ├── models/                # ML 模型
│   │   │   ├── emotion/           # 情绪识别
│   │   │   └── prediction/        # 关系预测
│   │   ├── services/              # 业务服务
│   │   ├── api/                   # FastAPI 路由
│   │   └── core/                  # 核心配置
│   ├── requirements.txt
│   └── Dockerfile
│
├── infrastructure/                # 基础设施配置
│   ├── docker/
│   │   └── docker-compose.yml
│   ├── k8s/
│   │   ├── namespaces/
│   │   ├── deployments/
│   │   └── services/
│   └── terraform/                 # 云资源编排
│
├── docs/                          # 项目文档
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DEPLOYMENT.md
│
└── .github/
    └── workflows/                 # CI/CD
        ├── mobile.yml
        ├── backend.yml
        └── ai-services.yml
```

---

## 八、部署架构

```
                    ┌──────────┐
                    │ CDN      │
                    │Cloudflare│
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ 负载均衡  │
                    │ (Nginx/  │
                    │  ALB)    │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        ┌──────────┐ ┌────────┐ ┌────────┐
        │ K8s Node │ │K8s Node│ │K8s Node│
        │  Pool 1  │ │ Pool 2 │ │ Pool 3 │
        │ (Backend)│ │(Backend│ │ (AI    │
        │          │ │  + WS) │ │GPU Node│
        └──────────┘ └────────┘ └────────┘
              │          │          │
              ▼          ▼          ▼
        ┌─────────────────────────────────┐
        │         数据层 (托管服务)          │
        │  RDS(PG) · ElastiCache(Redis)   │
        │  Milvus · OSS · Elasticsearch   │
        └─────────────────────────────────┘
```

---

## 九、MVP 阶段技术范围 (0-3个月)

### 优先实现

| 功能 | 技术要点 | 优先级 |
|------|---------|--------|
| 用户注册/登录 | JWT + 短信验证码 | P0 |
| 性格测试 | 前端问卷 + 后端评分 | P0 |
| 基础匹配 | 向量相似度 + 规则引擎 | P0 |
| AI 聊天建议 | LLM API + Prompt 工程 | P0 |
| 聊天截图分析 | DeepSeek Vision API | P0 |
| 实时聊天 | WebSocket + 消息队列 | P1 |
| 关系阶段判断 | LLM + 规则引擎 | P1 |
| 用户资料管理 | CRUD + 文件上传 | P1 |

### MVP 简化策略

- 初期使用 **单体应用** 而非微服务，快速迭代
- AI 能力优先调用 **云端 LLM API**，不自建模型
- 数据库初期可只用 **PostgreSQL + Redis**
- 部署使用 **Docker Compose**，后续迁移 K8s

---

## 十、技术栈版本总览

```
Frontend:    React Native 0.76+ / Expo SDK 52 / Next.js 15 / TypeScript 5.7
Backend:     NestJS 11 / Node.js 22 LTS / Prisma 6 / Socket.io 4
AI Service:  Python 3.12 / FastAPI 0.115 / LangChain 0.3 / DeepSeek V3+R1 / PyTorch 2.5
Database:    PostgreSQL 17 / Redis 7.4 / Milvus 2.4 / Elasticsearch 8.17
Infra:       Docker 27 / Kubernetes 1.31 / GitHub Actions
Monitoring:  Prometheus / Grafana / OpenTelemetry / ELK
```

---

## 十一、环境变量配置

所有敏感信息通过环境变量注入，**严禁**硬编码在代码中。参见项目根目录 `.env.example`。

```bash
# DeepSeek LLM
DEEPSEEK_API_KEY=sk-xxxxx              # DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com  # API 端点
DEEPSEEK_CHAT_MODEL=deepseek-chat      # 日常对话模型 (V3)
DEEPSEEK_REASONER_MODEL=deepseek-reasoner  # 推理模型 (R1)

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/linksoul
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Storage
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY=xxx
OSS_SECRET_KEY=xxx
OSS_BUCKET=linksoul

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

---

## 十二、关键技术决策说明

| 决策 | 选择 | 理由 |
|------|-----|------|
| 跨平台方案 | React Native + Expo | 比 Flutter 更贴近 Web 生态，组件库丰富，Web 复用度高 |
| 后端语言 | TypeScript (NestJS) | 前后端统一语言，类型共享，团队效率高 |
| AI 服务独立 | Python FastAPI | Python 是 AI/ML 生态的标准语言，独立部署可按需扩缩 |
| 数据库选型 | PostgreSQL | 支持 JSONB、全文搜索、扩展丰富，单库即可满足 MVP |
| 向量数据库 | Milvus | 开源、高性能、支持百万级向量检索 |
| 实时通信 | Socket.io | 成熟稳定，自动降级，房间管理便捷 |
| Monorepo | Nx/Turborepo | 统一管理前后端代码，共享类型和配置 |
