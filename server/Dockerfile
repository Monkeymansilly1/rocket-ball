# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787 DB_PATH=/app/data/rocket-ball.sqlite
WORKDIR /app
COPY --chmod=644 server/package*.json ./server/
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --prefix server --omit=dev --ignore-scripts --no-audit --no-fund --strict-ssl=true
COPY --chmod=644 server/index.js ./server/index.js
COPY --chmod=644 lib/online-rooms.js ./lib/online-rooms.js
RUN chmod 755 /app/server /app/lib && mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
