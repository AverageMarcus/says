var express = require('express');
var app = express();
var fs = require('fs');
var svgexport = require('svgexport');
var wrap = require('wordwrap')(30);

var port = process.env.PORT || 3000;

var people = {
  'ben' : {
    'file': 'ben.png',
    'x': 340,
    'y': 80,
    'fontSize': 25
  }
}

function generateImage(timestamp, person, text, done) {
  var formattedText = '';
  wrap(text).split('\n').forEach(function(line) {
    formattedText += `<tspan x="${people[person].x}" dy="25">${line}</tspan>`
  });

  var baseImage = fs.readFileSync(people[person].file);
  var base64Image = baseImage.toString('base64');
  var svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
    <svg xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="743px" height="418px" viewbox="0 0 743 418">
      <defs>
        <pattern id="img1" width="100%" height="100%">
          <image xlink:href="data:image;base64,${base64Image}" x="0" y="0" width="100%" height="100%" />
        </pattern>
      </defs>
      <path d="M0 0 H 743 V 418 H 0 L 0 0" fill="url(#img1)"/>
      <text x="${people[person].x}" y="${people[person].y}" font-family="Arial" font-size="${people[person].fontSize}">
          ${formattedText}
      </text>
    </svg>`;

  fs.writeFileSync(`${timestamp}.svg`, svg);

  svgexport.render({
      'input' : `${timestamp}.svg`,
      'output' : `${timestamp}.png`
    }, function(err) {

      done(err);
    });
}

app.get('/:person/:text', function (req, res) {
  var timestamp = Date.now();

  if(!people[req.params.person]) {
    return res.send('Unable to find person');
  }

  generateImage(timestamp, req.params.person, req.params.text, function(err) {
    if(err) return err;

    var returnImg = fs.readFileSync(`${timestamp}.png`);
    res.writeHead(200, {'Content-Type': 'image/png' });
    res.end(returnImg, 'binary');

    fs.unlink(`${timestamp}.svg`);
    fs.unlink(`${timestamp}.png`);
    return;
  })
});

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});