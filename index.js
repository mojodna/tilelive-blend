"use strict";

var url = require("url");

var _ = require("highland"),
    async = require("async"),
    mapnik = require("mapnik");

module.exports = function(tilelive, options) {
  var Blend = function(uri, callback) {
    if (typeof(uri) === "string") {
      uri = url.parse(uri, true);
    }

    this.layers = uri.query.layers;
    this.offsets = uri.query.offsets;
    this.opacities = uri.query.opacities;
    this.operations = uri.query.operations;
    this.filters = uri.query.filters;
    this.format = uri.query.format;

    _(this.layers)
      .map(_.wrapCallback(tilelive.load))
      .parallel(10)
      .stopOnError(function(err) {
        return callback(err);
      })
      .toArray(function(sources) {
        this.sources = sources;

        return callback(null, this);
      }.bind(this));
  };

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

  Blend.prototype.getTileHighland = function(z, x, y, callback) {
    var idx = 0;

    _(this.sources)
      .stopOnError(function(err) {
        return callback(err);
      })
      .map(function(source) {
        return _(function(push, next) {
          console.log("getTile");
          return source.getTile(z, x, y, function(err, buffer, headers) {
            console.log("gotTile");
            push(err, [buffer, headers]);
            return push(null, _.nil);
          });
        });
      })
      .parallel(10)
      .map(function(data) {
        var buffer = data[0],
            headers = data[1];

        return _(function(push, next) {
          console.log("fromBytes");
          return mapnik.Image.fromBytes(buffer, function(err, im) {
            console.log("fromBytten");
            push(err, [im, headers]);
            return push(null, _.nil);
          });
        });
      })
      .parallel(10)
      .map(function(data) {
        var im = data[0],
            headers = data[1];

        return _(function(push, next) {
          console.log("premultiply");
          return im.premultiply(function(err) {
            console.log("premultiplied");
            push(err, [im, headers]);
            return push(null, _.nil);
          });
        });
      })
      .parallel(10)
      .reduce1(function(a, b) {
        var im1 = a[0],
            im2 = b[0];

        return _(function(push, next) {
          console.log("composite", idx, this.operations[idx], this.filters[idx]);

          return im2.composite(im1, {
            comp_op: mapnik.compositeOp[this.operations[idx] || "src_over"],
            filters: this.filters[idx++]
          }, function(err, out) {
            console.log("composited");
            push(err, out);
            return push(null, _.nil);
          });
        }.bind(this));
      }.bind(this))
      .merge()
      .map(function(im) {
        return _(function(push, next) {
          console.log("demultiply");

          return im.demultiply(function(err) {
            console.log("demultiplied");
            setImmediate(function() {
            push(err, im);
            return push(null, _.nil);
            });
          });
        });
      })
      .parallel(10)
      .map(function(im) {
        return _(function(push, next) {
          console.log("encode");
          return im.encode(this.format, function(err, buffer) {
            console.log("encoded");
            push(err, buffer);
            return push(null, _.nil);
          });
        });
      })
      .parallel(10)
      .apply(function(buffer) {
        console.log("each", buffer);
        return callback(null, buffer);
      });
  };

  Blend.prototype.getInfo = function(callback) {
    return setImmediate(callback);
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
