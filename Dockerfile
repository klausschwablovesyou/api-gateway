# Stage 1: Build Angular frontend
FROM node:22-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source and shared types
COPY client/ ./
COPY shared/ ../shared/

# Build Angular application
RUN npm run build

# Stage 2: Setup Deno backend
FROM denoland/deno:2.6.3

# Install iproute2 for IP management (ip addr add/del commands)
# Run as root to allow ip addr add/del operations with NET_ADMIN capability
USER root
RUN apt-get update && apt-get install -y iproute2 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend source
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY deno.json ./

# Copy built frontend from previous stage to root public folder
COPY --from=client-builder /app/client/dist/client/browser ./public/

# Expose port
EXPOSE 3000

# Set environment variables
ENV DENO_ENV=production

# Cache backend dependencies
RUN cd backend && deno cache main.ts

# Run the application
WORKDIR /app/backend
CMD ["deno", "task", "start"]
