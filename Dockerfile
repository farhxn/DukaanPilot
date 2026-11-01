# Resolve and approve a current Node 22 image digest before production release.
ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts --no-audit
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm run db:generate

FROM dependencies AS migrate
CMD ["npm", "run", "db:migrate"]

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 APP_ENV=development AUTH_ENABLED=false AI_ENABLED=false AI_LIVE_DATA_ENABLED=false WHATSAPP_OUTBOUND_ENABLED=false
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts --no-audit

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production APP_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next-build ./.next-build
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
