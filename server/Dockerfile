# Development stage
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 8000

CMD ["npm", "run", "dev"]

# # Production stage
# FROM node:20-alpine AS production

# # Create app directory
# WORKDIR /app

# # Install app dependencies (package.json and package-lock.json copied first for better caching)
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy application source
# COPY . .

# # Change ownership to the existing node user
# RUN chown -R node:node /app

# # Switch to non-root user
# USER node

# # Port the app listens on
# EXPOSE 8000

# # Healthcheck (will hit /health or /status depending on app; adjust if needed)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
#   CMD wget -qO- --timeout=2 http://127.0.0.1:8000/health || exit 1

# # Start the app
# CMD ["npm", "start"]
