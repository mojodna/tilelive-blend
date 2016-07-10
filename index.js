"use strict";

var url = require("url"),
    util = require("util");

var async = require("async"),
    mapnik = require("mapnik"),
    mercator = new (require("sphericalmercator"))(),
    tiletype = require("tiletype");

var OPS = require("./comp-ops.json");

/**
 * Find the shortest provided max-age Cache-Control header in a list of
 * responses.
 */
var findShortestMaxAge = function(headers) {
  // determine the shortest max-age for an upstream tile and use that
  var maxAges = headers.map(function(h) {
    return (h["Cache-Control"] || h["cache-control"] || "").split(",").map(function(c) {
      return c.trim();
    }).filter(function(c) {
      return c.match(/^max-age=/);
    }).map(function(c) {
      return +c.split("=")[1];
    })[0];
  }).filter(function(age) {
    return age != null;
  });

  return Math.min.apply(null, maxAges);
};

module.exports = function(tilelive, options) {
  var Blend = function(uri, callback) {
    if (typeof(uri) === "string") {
      uri = url.parse(uri, true);
    }

    this.layers = uri.query.layers || [];
    this.format = uri.query.format || "png32";
    this.scale = +uri.query.scale || 1;
    this.tileSize = (uri.query.tileSize | 0) || Math.floor(256 * this.scale);

    this.info = uri.query.info || {};

    return setImmediate(function() {
      return callback(null, this);
    }.bind(this));
  };

  // TODO allow custom headers (User-Agent, X-Forwarded-For) to be passed
  // through
  Blend.prototype.getTile = function(z, x, y, callback) {
    var layers = this.layers,
        format = this.format,
        scale = this.scale,
        tileSize = this.tileSize;

    return async.map(this.layers, function(layer, done) {
      return async.waterfall([
        function(cb) {
          if (typeof(layer.source) === "string") {
            layer = url.parse(layer.source, true);
          }

          layer.query = layer.query || {};

          layer.query.scale = layer.query.scale || scale;
          layer.query.tileSize = layer.query.tileSize || tileSize;

          return tilelive.load(layer, cb);
        },
        function(source, cb) {
          return async.waterfall([
            function(_cb) {
              return source.getInfo(_cb);
            },
            function(info, _cb) {
              if (z < Math.max(0, info.minzoom | 0) || z > (info.maxzoom || Infinity)) {
                return callback();
              }

              var xyz = mercator.xyz(info.bounds || [-180, -85.0511, 180, 85.0511], z);

              if (x < xyz.minX ||
                  x > xyz.maxX ||
                  y < xyz.minY ||
                  y > xyz.maxY) {
                return callback();
              }

              return source.getTile(z, x, y, function(err, buffer, headers) {
                headers = headers || {};

                if (err && !err.message.match(/(Tile|Grid) does not exist/)) {
                  console.warn(err.stack);

                  // mark this tile as needing to be invalidated immediately
                  headers["cache-control"] = "public, max-age=0";
                }

                // always claim success; it'll be treated as a transparent tile
                // if it failed
                return _cb(null, buffer, headers);
              });
            }
          ], cb);
        },
        function(buffer, headers, cb) {
          if (buffer) {
            return mapnik.Image.fromBytes(buffer, function(err, data) {
              return cb(err, data, headers);
            });
          }

          // create an empty image if no data was provided
          return cb(null, new mapnik.Image(tileSize, tileSize), headers);
        },
        function(im, headers, cb) {
          return im.premultiply(function(err) {
            return cb(err, [im, headers]);
          });
        }
      ], done);
    }, function(err, data) {
      if (err) {
        console.warn(err);
        return callback(err);
      }

      var images = data.map(function(x) {
          return x[0];
        }),
        headers = data.map(function(x) {
          return x[1];
        }),
        maxAge = findShortestMaxAge(headers);

      var idx = 0;

      return async.waterfall([
        function(done) {
          return async.reduce(images, new mapnik.Image(tileSize, tileSize, {
            premultiplied: true
          }), function(im1, im2, cb) {
            return im1.composite(im2, {
              comp_op: mapnik.compositeOp[OPS[(layers[idx] || {})["comp-op"]] || "src_over"],
              opacity: parseFloat(layers[idx].opacity || 1),
              image_filters: layers[idx].filters || "",
              dx: Number((layers[idx].offset || [])[0] || 0),
              dy: Number((layers[idx++].offset || [])[1] || 0)
            }, cb);
          }, done);
        },
        function(im, cb) {
          return im.demultiply(cb);
        },
        function(im, cb) {
          return im.encode(format, cb);
        }
      ], function(err, buffer) {
        if (err) {
          return callback(err);
        }

        var headers = tiletype.headers(buffer);

        if (maxAge != null && maxAge < Infinity) {
          headers["cache-control"] = util.format("public, max-age=%d", maxAge);
        }

        return callback(null, buffer, headers);
      });
    });
  };

  Blend.prototype.getInfo = function(callback) {
    return setImmediate(callback, null, this.info);
  };

  Blend.prototype.close = function(callback) {
    return callback && setImmediate(callback);
  };

  Blend.registerProtocols = function(tilelive) {
    tilelive.protocols["blend:"] = Blend;
  };

  Blend.registerProtocols(tilelive);

  return Blend;
};
