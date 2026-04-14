FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build

COPY nest-cli.json ./
COPY tsconfig*.json ./
COPY src ./src
COPY test ./test

RUN npm run prisma:generate
RUN npm run build

FROM base AS production-deps

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npm cache clean --force

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=node:node /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node package*.json ./
COPY --chown=node:node scripts/docker/entrypoint.sh ./scripts/docker/entrypoint.sh

RUN chmod +x ./scripts/docker/entrypoint.sh

USER node

EXPOSE 3000

ENTRYPOINT ["./scripts/docker/entrypoint.sh"]
CMD ["node", "dist/main"]
