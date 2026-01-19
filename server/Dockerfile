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

# Expose port
EXPOSE 8000

# Start server with wrangler dev
CMD ["npm", "run", "dev", "--", "--port", "8000", "--ip", "0.0.0.0"]
