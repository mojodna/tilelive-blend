# Changes

## v0.4.4 - 7/10/16

* Actually, those should have been errors

## v0.4.3 - 7/10/16

* Include the correct number of params when calling back

## v0.4.2 - 7/10/16

* Handle layer URIs passed as objects

## v0.4.1 - 7/10/16

* Default `query` property of `uri`

## v0.4.0 - 7/10/16

* Allow `info` to be provided in `uri.query`
* Remove `layers` and `format` from exposed `info`

## v0.3.1 - 7/7/16

* Invalidate tiles that experienced errors, not missing tiles

## v0.3.0 - 7/6/16

* Calculate an appropriate `Cache-Control` header

## v0.2.3 - 7/6/16

* Default `scale` to `1`

## v0.2.2 - 7/6/16

* Calculate tile size according to scale (if not provided)

## v0.2.1 - 7/5/16

* Emit proper headers according to output image type

## v0.2.0 - 2/22/16

* Update dependencies
* Recast configuration with stacks
* Only request tiles expected to exist
* Log errors raised when loading sources
* Convert `mapnik` dependency to a peer dependency

## v0.1.0 - 7/11/14

* Initial version
