'use strict';

const queryString = require('query-string');
const _ = require('lodash');
const moment = require('moment');
const limit = require('simple-rate-limiter');
const t1 = require('terminalone');

let request = require('request');
// enable cookie jar
request = request.defaults({
  jar: true
});
//require('request-debug')(request);

const configModule = require('./config');

const t1Config = configModule.t1Config;
const t1ConnectionConfig = {
  user: t1Config.user,
  password: t1Config.password,
  api_key: t1Config.api_key
};
const connection = new t1.T1Connection(t1ConnectionConfig);

const processConfig = configModule.processConfig;

request = limit(request).to(processConfig.qps).per(1000);

const config = configModule.t1Config;

let t1Api = {};

/*
 * Login
 */

t1Api.login = function () {
  return new Promise((resolve, reject) => {
    request({
      url: config.t1ApiBase + '/login',
      method: 'POST',
      headers: {
        Accept: 'application/vnd.mediamath.v1+json'
      },
      form: {
        user: config.user,
        password: config.password,
        api_key: config.api_key
      },
      json: true
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve({
          sessionid: body.data.session.sessionid,
          expires: body.data.session.expires
        });
      } else {
        reject(body);
      }
    });
  });
};

/*
 * Display
 */

t1Api.getAllDisplayCreatives = function (id, limit) {
  return new Promise((resolve/*, reject*/) => {
    const creatives = [];
    getDisplayCreatives(id, limit, creatives, 0, () => {
      resolve(creatives);
    });
  });
};

function getDisplayCreatives(id, limit, creatives, offset, callback) {
  request({
    url: config.t1ApiBase + '/atomic_creatives/limit/' + limit + '=' + id,
    qs: {
      with: 'creatives',
      full: 'creative',
      q: 'status==1&media_type!=video',
      page_offset: offset
    },
    method: 'GET',
    headers: {
      Accept: 'application/vnd.mediamath.v1+json'
    },
    json: true
  }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      for (const creative of body.data) {
        creatives.push(creative.creatives[0]);
      }
      if (body.meta.next_page) {
        getDisplayCreatives(id, limit, creatives, queryString.parse(body.meta.next_page).page_offset, callback);
      } else {
        callback();
      }
    } else {
      throw error;
    }
  });

  /*const userParams = {
    'limit': [limit],
    'full': 'creative',
    'q': 'status==1&media_type!=video',
    'page_offset': offset
  };
  t1.EntityList.get('atomic_creatives', connection,  userParams)
    .then(function(list) {
      console.log(list);
      let retrievedNext = list.meta.next_page;
      if (typeof retrievedNext !== 'undefined') {
        return getDisplayCreatives(id, limit, creatives, retrievedNext, callback);
      } else {
        return callback();
      }
    });*/
}

/*
 * COMMON between Image & Video
 */


t1Api.tagCreative = (creativeId, tagCheckStr, tagToBeAdded) => {
  function CreativeFactory() {
    this.createCreativeTagger = function (type) {
      let creativeFactory;

      if (type === "ImageCreative_T1AS") {
        creativeFactory = new ImageCreative_T1AS();
      } else if (type === "ImageCreative_FBX") {
        creativeFactory = new ImageCreative_FBX();
      } else if (type === "ImageCreative_3PAS") {
        creativeFactory = new ImageCreative_3PAS();
      } else if (type === "VideoCreative") {
        creativeFactory = new VideoCreative();
      }

      creativeFactory.type = type;

      creativeFactory.checkAndTagCreative = function (creative, tagCheckStr, tagToBeAdded) {
        const urlContains =  new RegExp(tagCheckStr, "g");
        const itemFound = (creative.tag.match(urlContains) || []).length;
        if (itemFound > 0) {
          if (itemFound > 1) {
            // tagged more then once
            console.log(`${creative.atomic_creative_id}\tDuplicate Tag\t${itemFound}\t${JSON.stringify(creative.tag)}\n`);
          } else {
            console.log(`${creative.atomic_creative_id}\tSuccess\t${itemFound}\t${JSON.stringify(creative.tag)}\n`);
          }
        } else {
          // tag not found
          console.log(`${creative.atomic_creative_id}\tUntagged\t0\t${JSON.stringify(creative.tag)}\n`);
          creative = this.changeSpecializedCreative(creative, tagToBeAdded);
        }
        console.log(creative);
        return creative.save(connection);
      };

      return creativeFactory;
    }
  }
  const factory = new CreativeFactory();

  const ImageCreative_T1AS = function () {
    this.changeSpecializedCreative = (creative, tagToBeAdded) => {
      creative.tpas_ad_tag = creative.tpas_ad_tag + tagToBeAdded;
      return creative;
    }
  };

  const ImageCreative_FBX = function () {
    this.changeSpecializedCreative = (creative, tagToBeAdded) => {
      creative.tag = creative.tag + ',' + tagToBeAdded;
      return creative;
    }
  };

  const ImageCreative_3PAS = function () {
    this.changeSpecializedCreative = (creative, tagToBeAdded) => {
      creative.tag = creative.tag + tagToBeAdded;
      return creative;
    }
  };

  const VideoCreative = function () {
    this.checkAndTagCreative = function (creative, tagCheckStr, tagToBeAdded) {
      return new Promise((resolve, reject) => {
        resolve("VIDEO saved");
      })
    }
  };

  return new Promise((resolve, reject) => {
    new t1.Entity('atomic_creative')
      .get(creativeId, connection)
      .then(creative => {
        const setting = `${creative.ad_format}->${creative.file_type}`;
        let creativeTaggerType = "";
        if (setting === "DISPLAY->vast") {
          creativeTaggerType = "VideoCreative";
        } else {
          if (creative.t1as) {
            creativeTaggerType = "ImageCreative_T1AS";
          } else {
            const dimensions = `${creative.width}x${creative.height}`;
            if (['110x80', '470x276', '254x133'].indexOf(dimensions) !== -1) {
              creativeTaggerType = "ImageCreative_FBX";
            } else {
              creativeTaggerType = "ImageCreative_3PAS";
            }
          }
        }
        let creativeTagger = factory.createCreativeTagger(creativeTaggerType);
        creativeTagger.checkAndTagCreative(creative, tagCheckStr, tagToBeAdded);
      })
      .then(() => resolve('saved'))
      .catch(error => reject(error));
  });
};

/*
 * Video
 */

// Return all video creatives for a given orgID
t1Api.getAllVideoCreatives = function (id, limit) {
  return new Promise((resolve, reject) => {
    const creativeIds = [];
    getVideoCreativeIds(id, limit, creativeIds, 0, () => {
      // Pagination
      const batches = _.chunk(creativeIds, 100);
      let promises = [];
      for (const batch of batches) {
        promises.push(getVideoCreatives(batch));
      }

      // Flatten array then resolve promise
      Promise.all(promises)
        .then(results => {
          //console.log(_.flatten(log).length);
          resolve(_.flatten(results));
        })
        .catch(() => {
          reject();
        });
    });
  });
};

// Get all video creative IDs --> pagination until its finish
function getVideoCreativeIds(id, limit, creativeIds, offset, callback) {
  request({
    url: config.t1ApiBase + '/atomic_creatives/limit/' + limit + '=' + id,
    qs: {
      full: 'atomic_creative',
      q: 'status==1&media_type==video',
      page_offset: offset
    },
    method: 'GET',
    headers: {
      Accept: 'application/vnd.mediamath.v1+json'
    },
    json: true
  }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      for (const creative of body.data) {
        creativeIds.push(creative.id);
      }
      if (body.meta.next_page) {
        getVideoCreativeIds(id, limit, creativeIds, queryString.parse(body.meta.next_page).page_offset, callback);
      } else {
        callback();
      }
    } else {
      throw error;
    }
  });
}

// Get video creatives for given creative Ids
function getVideoCreatives(creativeIds) {
  return new Promise((resolve, reject) => {
    request({
      url: config.t1VideoApiBase + '/creatives',
      qs: {
        creativeIds: creativeIds.toString()
      },
      method: 'GET',
      json: true
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        const objKeys = Object.keys(body.creatives);
        let creatives = [];
        for (const objKey of objKeys) {
          const newObj = body.creatives[objKey];
          newObj.$key = objKey;
          creatives.push(newObj);
        }
        resolve(creatives);
      } else {
        reject();
      }
    });
  });
}

module.exports = t1Api;
