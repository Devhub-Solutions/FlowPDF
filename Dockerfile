# Stage 1: Build frontend
FROM mirror.gcr.io/library/node:18-alpine AS frontend-builder

WORKDIR /app/frontend
ENV NODE_ENV=development
RUN npm config set strict-ssl false
COPY frontend/package*.json ./
RUN npm ci --include=dev && test -x node_modules/.bin/vite
COPY frontend/index.html frontend/tsconfig.json frontend/tsconfig.node.json ./
COPY frontend/vite.config.ts frontend/postcss.config.js frontend/tailwind.config.js ./
COPY frontend/src ./src
RUN npm run build

# Stage 2: Build API
FROM mirror.gcr.io/library/node:18-alpine AS api-builder

WORKDIR /app/api
ENV NODE_ENV=development
RUN npm config set strict-ssl false
COPY api/package*.json api/tsconfig.json ./
RUN npm ci --include=dev && test -x node_modules/.bin/tsc
COPY api/src ./src
RUN npm run build

# Stage 3: Production runtime
FROM mirror.gcr.io/library/node:18-alpine AS runner

WORKDIR /app
RUN npm config set strict-ssl false

# Install production dependencies
COPY api/package*.json ./
RUN npm ci --omit=dev

# Copy API build output
COPY --from=api-builder /app/api/dist ./dist

# Copy frontend build output to public directory
COPY --from=frontend-builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080

LABEL org.opencontainers.image.source=https://github.com/Devhub-Solutions/FlowPDF
LABEL org.opencontainers.image.description="FlowPDF - DOCX template to PDF rendering service"
LABEL org.opencontainers.image.licenses=MIT

EXPOSE 8080

CMD ["node", "dist/index.js"]
