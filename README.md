# tilelive-blend

Will it blend?

## Usage

```javascript
{
  protocol: "blend:",
  query: {
    layers: [
      "tilejson+http://staging.tile.stamen.com/toner-background/index.json",
      "tilejson+http://staging.tile.stamen.com/toner-labels/index.json"
    ],
    operations: [
      "" // src_over
    ],
    filters: [
      "" // nothing
    ]
    format: "png32:z=1"
  }
}
```

If you need to blend over a solid color, use
[`tilelive-solid`](https://github.com/mojodna/tilelive-solid).
