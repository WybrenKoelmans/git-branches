FROM node:18-alpine3.17

RUN apk add --no-cache krb5-libs libstdc++ libgcc libintl libssl1.1 ca-certificates zlib gcompat python3 make g++ krb5-dev

COPY package.json package.json
#COPY yarn.lock yarn.lock

RUN yarn install

COPY . .

CMD  [ "yarn" ,  "ts-node", "-T", "index.ts" ]
