# ============================================================================
# PepNationRX API - production container image.
# ----------------------------------------------------------------------------
# A small single-stage image on the Node 22 LTS slim base. Dependencies are
# installed from the lockfile-pinned manifest with devDependencies excluded,
# the source is copied in, and the process runs as a non-root user.
# ============================================================================

FROM node:22-slim

# The API listens on this port; the orchestrator maps it.
ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /usr/src/app

# Install production dependencies first so this layer is cached across source
# changes. package.json (and package-lock.json when present) define the set.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy the application source.
COPY src ./src

# Drop to the unprivileged user that the base image already provides.
USER node

EXPOSE 4000

# Container health is the API readiness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
