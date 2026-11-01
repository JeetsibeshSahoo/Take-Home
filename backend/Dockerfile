# Use official lightweight Node.js 20 LTS Alpine image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose backend API port
EXPOSE 5000

# Start container: run migrations, seed data, then launch server
CMD ["npm", "run", "start:migrate"]