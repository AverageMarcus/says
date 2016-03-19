FROM cmfatih/slimerjs:latest

RUN apt-get update && apt-get upgrade -y
RUN apt-get install curl -y
RUN curl -sL https://deb.nodesource.com/setup_5.x | bash -
RUN apt-get install nodejs firefox -y

COPY package.json /src/package.json
RUN cd /src; npm install
COPY ./ /src/

RUN chmod +x -R /src/node_modules/*

EXPOSE 3000

CMD ["node", "--harmony", "/src/app.js"]