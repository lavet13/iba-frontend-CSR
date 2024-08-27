# 1. Build React app
FROM node:18.18.0-alpine as build

WORKDIR /app

COPY package.json yarn.lock ./

# Same as npm install
RUN yarn install --ignore-engines

COPY . .

RUN yarn build

# 2. Serve static files with Nginx
FROM nginx:1.24.0-alpine

# Copy config nginx
COPY --from=build /app/.nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Copy static assets from builder stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Containers run nginx with global directives and daemon off
CMD ["nginx", "-g", "daemon off;"]
