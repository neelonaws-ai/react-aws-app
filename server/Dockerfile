FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3001
ENV SECRET_NAME=sf-account-app/config
ENV AWS_REGION=ap-southeast-2
EXPOSE 3001
CMD ["node", "server.js"]
