"use strict";

var fs = require("fs");

var tilelive = require("tilelive");

require("tilejson").registerProtocols(tilelive);
require("./")(tilelive);

tilelive.load({
  protocol: "blend:",
  query: {
    layers: [
      {
        source: "tilejson+http://staging.tile.stamen.com/toner-background/index.json",
        opacity: 0.5,
        filters: "color-to-alpha(#008800)",
        offset: [5, -5]
      },
      {
        source: "tilejson+http://staging.tile.stamen.com/toner-lines/index.json",
        filters: "invert agg-stack-blur(1,1)" 
      },
      {
        source: "tilejson+http://staging.tile.stamen.com/toner-labels/index.json",
        "comp-op": "over"
      }
    ],
    format: "png32:z=1"
  }
}, function(err, source) {
  if (err) {
    throw err;
  }

  return source.getTile(12, 656, 1430, function(err, data) {
    if (err) {
      throw err;
    }

    return fs.writeFileSync("./out.png", data);
  });
});
