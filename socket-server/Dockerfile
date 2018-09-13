FROM node:alpine
WORKDIR /usr/src/app
# Install nodemon
RUN npm install -g nodemon
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 9000 9004
CMD [ "npm", "start" ]
