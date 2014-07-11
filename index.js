"use strict";

var url = require("url");

var async = require("async"),
    mapnik = require("mapnik");

module.exports = function(tilelive, options) {
  var Blend = function(uri, callback) {
    if (typeof(uri) === "string") {
      uri = url.parse(uri, true);
    }

    this.layers = uri.query.layers || [];
    this.offsets = uri.query.offsets || [];
    this.opacities = uri.query.opacities || [];
    this.operations = uri.query.operations || [];
    this.filters = uri.query.filters || [];
    this.format = uri.query.format || "png";

    return async.map(this.layers, function(layer, done) {
      return tilelive.load(layer, done);
    }, function(err, sources) {
      this.sources = sources;

      return callback(null, this);
    }.bind(this));
  };

  // TODO retina support / tileSize / scale
  Blend.prototype.getTile = function(z, x, y, callback) {
    var offsets = this.offsets,
        opacities = this.opacities,
        operations = this.operations,
        filters = this.filters,
        format = this.format;

    return async.map(this.sources, function(source, done) {
      return async.waterfall([
        function(cb) {
          return source.getTile(z, x, y, cb);
        },
        function(buffer, headers, cb) {
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
      ], callback);
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
