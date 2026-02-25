FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend ./apps/backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @linksoul/backend build
RUN pnpm --filter @linksoul/backend prisma:generate

EXPOSE 3000

CMD ["pnpm", "--filter", "@linksoul/backend", "start:prod"]
