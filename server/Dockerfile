FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages ./packages

# Install dependencies (including local packages)
RUN npm install
RUN cd packages/relations-engine && npm install && npm run build

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
