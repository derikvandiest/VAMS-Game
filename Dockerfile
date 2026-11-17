# ELD PD Game — one container that serves the game website and runs the multiplayer server.
#
#   docker build -t eld-pd-game .
#   docker run -p 3001:3001 eld-pd-game        → open http://localhost:3001
#
# Most hosts (Render, Railway, Fly.io, Google Cloud Run, …) can build this file directly.

# --- 1) Build the browser game into /app/dist ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- 2) The running server: only what it needs ------------------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY content ./content
COPY tsconfig.json ./
COPY --from=build /app/dist ./dist
# The host sets PORT; 3001 is the default.
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT:-3001}/api/health || exit 1
USER node
CMD ["npx", "tsx", "server/src/index.ts"]
