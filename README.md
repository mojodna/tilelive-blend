# tilelive-blend

Will it blend?

## Usage

```javascript
{
  protocol: "blend:",
  query: {
    layers: [
      {
        source: "tilejson+http://tile.stamen.com/toner-background/index.json",
        opacity: 0.5,
        filters: "color-to-alpha(#008800)",
        offset: [5, -5]
      },
      {
        source: "tilejson+http://tile.stamen.com/toner-lines/index.json",
        filters: "invert agg-stack-blur(1,1)"
      },
      {
        source: "tilejson+http://tile.stamen.com/toner-labels/index.json",
        "comp-op": "over"
      }
    ],
    format: "png32:z=1"
  }
}
```

If you need to blend over a solid color, use
[`tilelive-solid`](https://github.com/mojodna/tilelive-solid).
