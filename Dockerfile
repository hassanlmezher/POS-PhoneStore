FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
# prisma.config.ts reads DATABASE_URL at load time; a placeholder lets `prisma generate`
# run during the build. The real URL comes from the environment at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# Full node_modules (not just the standalone subset) so `prisma migrate deploy` and the seed work.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/lib/generated ./lib/generated
COPY --from=build /app/lib/shop-defaults.ts ./lib/shop-defaults.ts
COPY --from=build /app/prisma.config.ts /app/package.json ./
COPY --from=build /app/lib/pg-config.ts ./lib/pg-config.ts
COPY --from=build /app/certs ./certs
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
USER node
EXPOSE 3000
# Apply pending migrations, then start. Safe to run on every boot.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]
