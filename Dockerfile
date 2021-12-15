FROM node:12
WORKDIR /app
COPY package*.json monkey-patch.sh ./
# --unsafe-perm required to run the postinstall script as the root user
RUN npm install --unsafe-perm
COPY . .
CMD ["npm", "start"]
