Fennec vehicle supplied by the project owner as `Fennec.fbx`.
Converted with Blender to a self-contained GLB using `tools/convert-car-assets.py`.
Original mesh, UVs and material assignments preserved. The source references three
external normal maps which were not embedded; missing image links were removed.
No third-party license is inferred from the upload.
`body.js` bundles the same supplied mesh and four wheel pivots without separate
model or texture requests. Regenerate with `python tools/bundle-car-bodies.py fennec`.
