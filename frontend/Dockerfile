# Use lightweight Node.js 20 Alpine
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for layer caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build application for production
RUN npm run build

# Expose Vite preview port
EXPOSE 5173

# Run preview server
CMD ["npm", "run", "preview"]