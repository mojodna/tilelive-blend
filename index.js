"use strict";

var url = require("url");

var async = require("async"),
    mapnik = require("mapnik"),
    tiletype = require("tiletype");

module.exports = function(tilelive, options) {
  var Blend = function(uri, callback) {
    if (typeof(uri) === "string") {
      uri = url.parse(uri, true);
    }

    this.layers = uri.query.layers || [];
    this.offsets = uri.query.offsets || [];
    this.opacities = (uri.query.opacities || []).map(Number);
    this.operations = uri.query.operations || [];
    this.filters = uri.query.filters || [];
    this.format = uri.query.format || "png";
    this.scale = uri.query.scale;
    this.tileSize = (uri.query.tileSize | 0) || 256;

    // warm the cache (note: assumes there is a cache)
    setImmediate(function() {
      var scale = this.scale,
          tileSize = this.tileSize;

      return async.mapSeries(this.layers, function(layer, done) {
        if (typeof(layer) === "string") {
          layer = url.parse(layer, true);
        }

        layer.query.scale = layer.query.scale || scale;
        layer.query.tileSize = layer.query.tileSize || tileSize;

        return tilelive.load(layer, done);
      });
    }.bind(this));

    return setImmediate(function() {
      return callback(null, this);
    }.bind(this));
  };

  Blend.prototype.getTile = function(z, x, y, callback) {
    var offsets = this.offsets,
        opacities = this.opacities,
        operations = this.operations,
        filters = this.filters,
        format = this.format,
        scale = this.scale,
        tileSize = this.tileSize;

    return async.map(this.layers, function(layer, done) {
      return async.waterfall([
        function(cb) {
          if (typeof(layer) === "string") {
            layer = url.parse(layer, true);
          }

          layer.query.scale = layer.query.scale || scale;
          layer.query.tileSize = layer.query.tileSize || tileSize;

          return tilelive.load(layer, cb);
        },
        function(source, cb) {
          return source.getTile(z, x, y, function(err, buffer) {
            // TODO capture headers
            return cb(err, buffer);
          });
        },
        function(buffer, cb) {
          return mapnik.Image.fromBytes(buffer, cb);
        },
        function(im, cb) {
          return im.premultiply(function(err) {
            return cb(err, im);
          });
        }
      ], done);
    }, function(err, images) {
      if (err) {
        return callback(err);
      }

      var idx = 0;

      return async.waterfall([
        function(done) {
          return async.reduce(images.slice(1), images[0], function(im1, im2, cb) {
            return im1.composite(im2, {
              comp_op: mapnik.compositeOp[operations[idx] || "src_over"],
              opacity: opacities[idx] || 1,
              image_filters: filters[idx] || "",
              dx: (offsets[idx] || [])[0] || 0,
              dy: (offsets[idx++] || [])[1] || 0
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
        offsets: this.offsets,
        opacities: this.opacities,
        operations: this.operations,
        filters: this.filters,
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
