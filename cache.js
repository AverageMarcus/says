'use strict';
const mp = require('mongodb-promise');
let collection;

let Cache = function(options) {
  let url = options.url || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/cache';
  console.log(`MongoDB URL: ${url}`);
  mp.MongoClient
    .connect(url)
    .then(function(db){
      db.collection('says').then(function(col) {
        collection = col;
      });
    }, function(err) {
      console.log('MongoDB not available - cache disabled');
    });
};

Cache.prototype.save = function(key, value) {
  return new Promise((resolve, reject) => {
    if(collection) {
      return collection.update({key:key}, {key:key, value:value}, {upsert:true})
        .then(function(result) {
          resolve();
        });
    } else {
      resolve();
    }
  });
};

Cache.prototype.get = function(key) {
  return new Promise((resolve, reject) => {
    if(collection) {
      collection.findOne({key:key}).then(function(doc) {
        resolve(doc.value);
      }).fail(function() {
        resolve();
      });
    } else {
      resolve();
    }
  });
};

module.exports = Cache;
