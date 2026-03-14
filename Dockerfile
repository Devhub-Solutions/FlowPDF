# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build API
FROM node:20-alpine AS api-builder

WORKDIR /app/api
COPY api/package*.json ./
RUN npm install
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install production dependencies
COPY api/package*.json ./
RUN npm install --omit=dev

# Copy API build output
COPY --from=api-builder /app/api/dist ./dist

# Copy frontend build output to public directory
COPY --from=frontend-builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
