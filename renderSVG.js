'use strict';
const driver = require('node-phantom-simple');

function toPNG(timestamp, done) {
  return new Promise((resolve, reject) => {
    driver.create({ path: require('slimerjs').path }, function (err, browser) {
      if(err) throw err;
      return browser.createPage(function (err, page) {
        page.open(`file://${__dirname}/view.html?${timestamp}.svg`, function (err,status) {
          page.set('viewportSize', { width:743, height:418 }, function() {
            page.render(`${timestamp}.png`);
            return resolve(browser.exit());
          });
        });
      });
    });
  });
}

module.exports = {
  toPNG: function(timestamp) {
    return new Promise((resolve, reject) => {
      toPNG(timestamp).then(() => {
        // Need to do this to force the render to complete (no idea why)
        setTimeout(resolve, 100);
      });
    });
  }
};