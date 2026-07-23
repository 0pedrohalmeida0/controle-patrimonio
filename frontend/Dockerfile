# syntax=docker/dockerfile:1.6

# ---- Builder ---------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json ./
# Use npm ci when lockfile present, else npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---- Runtime ---------------------------------------------------------------
FROM nginx:alpine AS runtime

# Custom nginx config for SPA + correct MIME / caching.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
