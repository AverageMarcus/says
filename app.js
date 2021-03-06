'use strict';
const express = require('express');
const exphbs  = require('express-handlebars');
const fs = require('fs');
const svgexport = require('svgexport');
const wrap = require('wordwrap')(30);
const Imagemin = require('imagemin');
const request = require('request').defaults({ encoding: null });

const port = process.env.PORT || 3000;

const app = express();
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

let Cache =require('./cache');
let cache = new Cache({});

const people = require('./people');

// Base64 images on start
for(let person in people) {
  if(people.hasOwnProperty(person)) {
    let baseImage = fs.readFileSync(people[person].file);
    people[person].file = 'data:image;base64,' + baseImage.toString('base64');
    people[person].titleName = person.charAt(0).toUpperCase() + person.substr(1).toLowerCase();
  }
}

function generateImageSVG(person, url) {
  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="743px" height="418px" viewbox="0 0 743 418">
      <defs>
        <pattern id="img1" width="100%" height="100%">
          <image xlink:href="${person.file}" x="0" y="0" width="100%" height="100%" />
        </pattern>
        <pattern id="img2" width="100%" height="100%">
          <image  x="0" y="0" width="${person.boundingBox.width}" height="${person.boundingBox.height}" preserveAspectRatio="none" xlink:href="${url}" />
        </pattern>
      </defs>
      <path d="M0 0 H 743 V 418 H 0 L 0 0" fill="url(#img1)"/>
      <path d="${person.boundingBox.path}" fill="url(#img2)"/>
    </svg>`;

  return svg;
}

function generateTextSVG(person, text) {
  let formattedText = '';
  wrap(text).split('\n').forEach((line) => {
    formattedText += `<tspan x="${person.x}" dy="25">${line}</tspan>`
  });

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="743px" height="418px" viewbox="0 0 743 418">
      <defs>
        <pattern id="img1" width="100%" height="100%">
          <image xlink:href="${person.file}" x="0" y="0" width="100%" height="100%" />
        </pattern>
      </defs>
      <path d="M0 0 H 743 V 418 H 0 L 0 0" fill="url(#img1)"/>

      <switch>
        <foreignObject x="${person.x}" y="${person.y}" width="${person.boundingBox.width}" height="${person.boundingBox.height}" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility">
          <p xmlns="http://www.w3.org/1999/xhtml"
              style="transform:rotate(${person.rotation} ${person.x} ${person.y}); font-family:sans-serif; color:${person.colour}; font-size:${person.fontSize};">
            ${text}
          </p>
        </foreignObject>
        <text x="${person.x}" y="${person.y}" transform="rotate(${person.rotation} ${person.x} ${person.y})" font-family="sans-serif" fill="${person.colour}" font-size="${person.fontSize}">
            ${formattedText}
        </text>
      </switch>


    </svg>`;

  return svg;
}

function processSVG(timestamp, svg, done) {
  fs.writeFileSync(`${timestamp}.svg`, svg);

  svgexport.render({
      'input' : `${timestamp}.svg`,
      'output' : `${timestamp}.png`
    }, (err) => {
      new Imagemin()
        .src(`${timestamp}.png`)
        .dest(`./`)
        .use(Imagemin.optipng({optimizationLevel: 1}))
        .run((err, files) => {
          done(err);
        });
    });
}

function processRequest(req, res) {
  const timestamp = Date.now();
  let personName;
  if(req.params.person) {
    personName = req.params.person.toLowerCase();
  } else {
    // Random person
    let peopleNames = Object.keys(people);
    personName = peopleNames[peopleNames.length * Math.random() << 0];
  }

  if(!people[personName]) {
    return res.send('Unable to find person');
  }

  let svgFunction = generateTextSVG;
  let message = req.params.text;
  if(req.params.url) {
    // Image overlay
    svgFunction = generateImageSVG;
    message = req.params.url;
  }
  let key = `${personName}|${message}`;
  console.log(`Requested: ${key}`);

  cache.get(key)
    .then(function(value) {
      res.writeHead(200, {'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' });

      if(value) {
        res.end(value.buffer);
      } else {
        let svg = svgFunction(people[personName], message);
        processSVG(timestamp, svg, function(err) {
          if(err) return err;

          let returnImg = fs.readFileSync(`${timestamp}.png`);
          cache.save(key, returnImg);

          res.end(returnImg, 'binary');


          fs.unlink(`${timestamp}.svg`);
          fs.unlink(`${timestamp}.png`);
          return;
        });
      }
      console.log('Request processed');
    });
}

app.get('/custom', function(req, res) {
  const timestamp = Date.now();
  request.get(req.query.image, function (err, response, body) {
    if (!err && response.statusCode == 200) {
        let base64Image = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
        let customPerson = {
          file: base64Image,
          x: req.query.x,
          y: req.query.y,
          rotation: req.query.rotation || 0,
          fontSize: req.query.fontSize || 25
        };


        let key = `${req.query.image}|${req.query.message}`;
        cache.get(key)
          .then(function(value) {
            if(value) {
              res.writeHead(200, {'Content-Type': 'image/png' });
              res.end(value.buffer);
            } else {
              let svg = generateTextSVG(customPerson, req.query.message);
              processSVG(timestamp, svg, function(err) {
                if(err) return err;

                let returnImg = fs.readFileSync(`${timestamp}.png`);
                cache.save(key, returnImg);
                res.writeHead(200, {'Content-Type': 'image/png' });
                res.end(returnImg, 'binary');

                fs.unlink(`${timestamp}.svg`);
                fs.unlink(`${timestamp}.png`);
                return;
              });
            }
          });
    }
  });
});

app.get('/random/:text', processRequest);

app.get('/image/:person/:url', processRequest);

app.get('/:person/:text', processRequest);

app.get('/people', function(req, res) {
  let result = [];
  for(let person in people) {
    result.push(person);
  }
  res.send(result);
})

app.get('*', function(req, res) {
  res.render('index', {people: people});
});

app.listen(port, function () {
  console.log(`Says app listening on port ${port}!`);
});
