# 1. Build React app
FROM node:lts as build

WORKDIR /app

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock

# Same as npm install
RUN yarn install --ignore-engines

COPY . .

RUN yarn build

# 2. Serve static files with Nginx
FROM nginx:alpine

# Copy config nginx
COPY --from=build /app/.nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage
COPY --from=build /app/dist .

# Containers run nginx with global directives and daemon off
ENTRYPOINT ["nginx", "-g", "daemon off;"]
