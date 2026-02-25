# 腾讯云 CVM 自动化部署 + 微信小程序壳

## 1. 准备条件

- 一台 Ubuntu 22.04+ 腾讯云 CVM（公网 IP）
- 已备案域名，并添加 DNS 解析：
  - `your-domain.com` -> CVM 公网 IP
- 安全组放行：`22`、`80`、`443`

## 2. 服务器初始化

```bash
sudo -i
mkdir -p /opt
cd /opt
git clone <your-repo-url> linksoul
cd linksoul
cp .env.prod.example .env.prod
cp ai-services/.env.prod.example ai-services/.env.prod
```

编辑 `.env.prod`（至少填写）：

- `APP_DOMAIN`
- `PROJECT_BASE_PATH`（默认 `/linksoul`）
- `LETSENCRYPT_EMAIL`
- `JWT_SECRET`
- `DEEPSEEK_API_KEY`
- 其他业务相关密钥

## 3. 一键初始化与首发部署

```bash
sudo bash scripts/deploy/tencent-cvm-bootstrap.sh
```

该脚本会：

- 安装 Docker / Docker Compose / Certbot
- 读取 `.env.prod`
- 申请证书（Let's Encrypt）
- 调用 `scripts/deploy/tencent-cvm-deploy.sh` 完成首次部署

## 4. 日常发布

```bash
sudo DEPLOY_BRANCH=main bash scripts/deploy/tencent-cvm-deploy.sh
```

发布流程：

- 拉取最新代码
- 构建 backend/admin/ai 镜像
- 启动 postgres/redis
- 执行 `prisma migrate deploy`
- 启动 backend/ai/admin/nginx
- 执行健康检查：
  - `https://<domain>/linksoul/api/v1/health`
  - `https://<domain>/linksoul/admin/`
  - `https://<domain>/linksoul/mobile/`

## 5. 微信小程序壳

小程序壳目录：

- `apps/wechat-mini/`

使用方法：

1. 微信开发者工具 -> 导入项目 -> 选择 `apps/wechat-mini`
2. 将 `apps/wechat-mini/app.js` 中的 `webviewUrl` 改为你的线上 H5 地址（例如 `https://your-domain.com/linksoul/mobile/`）
3. 在微信公众平台配置：
   - 业务域名（web-view）
   - request 合法域名（如 `https://your-domain.com`）

## 6. 证书续签

可配置系统定时任务（crontab）：

```bash
0 3 * * * certbot renew --quiet && docker restart linksoul-nginx-prod
```

## 7. 重要说明

- 当前后端 Prisma `datasource provider` 为 `sqlite`，生产默认使用：
  - `DATABASE_URL=file:/app/data/prod.db`
- `docker-compose.prod.yml` 中包含 PostgreSQL 服务，主要用于后续切换 PostgreSQL 时复用；若未切换 Prisma provider，后端不会实际使用 PostgreSQL。
- 当前目录路由约定：
  - `/linksoul/api/v1/*` -> backend
  - `/linksoul/admin/*` -> admin
  - `/linksoul/mobile/*` -> mobile web 入口（当前代理到 admin 容器，可后续替换）
