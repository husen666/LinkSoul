FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin ./apps/admin

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @linksoul/admin build

EXPOSE 4173

CMD ["pnpm", "--filter", "@linksoul/admin", "preview", "--host", "0.0.0.0", "--port", "4173"]
