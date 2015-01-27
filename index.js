"use strict";

var url = require("url");

var async = require("async"),
    mapnik = require("mapnik"),
    mercator = new (require("sphericalmercator"))(),
    tiletype = require("tiletype");

var OPS = require("./comp-ops.json");

module.exports = function(tilelive, options) {
  var Blend = function(uri, callback) {
    if (typeof(uri) === "string") {
      uri = url.parse(uri, true);
    }

    this.layers = uri.query.layers || [];
    this.format = uri.query.format || "png32";
    this.scale = uri.query.scale;
    this.tileSize = (uri.query.tileSize | 0) || 256;

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

              return source.getTile(z, x, y, function(err, buffer) {
                // TODO capture headers

                if (err) {
                  console.warn(err.stack);
                }

                if (err && !err.message.match(/Tile|Grid does not exist/)) {
                  console.warn(err.stack);
                }

                // always claim success; it'll be treated as a transparent tile
                // if it failed
                return _cb(null, buffer);
              });
            }
          ], cb);
        },
        function(buffer, cb) {
          if (buffer) {
            return mapnik.Image.fromBytes(buffer, cb);
          }

          // create an empty image if no data was provided
          return cb(null, new mapnik.Image(tileSize, tileSize));
        },
        function(im, cb) {
          return im.premultiply(function(err) {
            return cb(err, im);
          });
        }
      ], done);
    }, function(err, images) {
      if (err) {
        console.warn(err);
        return callback(err);
      }

      var idx = 0;

      return async.waterfall([
        function(done) {
          return async.reduce(images, new mapnik.Image(tileSize, tileSize), function(im1, im2, cb) {
            console.log(layers[idx].opacity);
            return im1.composite(im2, {
              comp_op: mapnik.compositeOp[OPS[(layers[idx] || {})["comp-op"]] || "src_over"],
              opacity: parseInt(layers[idx].opacity || 1),
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

        var headers = tiletype.headers(tiletype.type(buffer));

        return callback(null, buffer, headers);
      });
    });
  };

  Blend.prototype.getInfo = function(callback) {
    return setImmediate(function() {
      return callback(null, {
        layers: this.layers,
        format: this.format
      });
    }.bind(this));
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
