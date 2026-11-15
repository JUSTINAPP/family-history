# Photo rotation, crop and perspective review

Bulk photo imports offer “Suggest rotation and crop after upload”. Originals are uploaded unchanged first. The review panel checks each source sequentially using the existing configured document/image AI provider. Suggestions are never applied automatically. Members can review individual images, accept suggestions with confidence at least 0.9 and no uncertainty flag together, or pause between checks. Reopening a completed batch requires choosing Check images; it does not automatically repeat paid analysis.

For an existing photo or scanned page: open its item, expand Image options, choose Straighten and crop. Move the four numbered corners (touch, mouse or arrow keys), rotate, compare the preview and Save correction. Restore original resets framing in the editor; Save applies the restoration. Full-original downloads remain unchanged.

## Preservation and access

Corrections generate new private display/thumbnail/small derivatives, using the original bytes with checksum verification. Coordinates and baked rotation are recorded in the existing image-set manifest and provenance. Older sets and originals remain stored. No migration or dependency is required. Current archive permissions apply; concurrent crop saves check the expected image-set version. Existing rotation controls act as an additional display rotation. Preview regeneration retains the saved crop.

The image-reading service receives a reduced image over the existing server-only provider transport. Provider credentials never enter browser bundles. No provider configured, ambiguous output, download failure or invalid corners leaves manual editing available. Perspective correction uses a four-corner projective transform, not generated image reconstruction. It does not remove glare or restore damaged details. Multiple prints in one upload are not split automatically: this version suggests the largest complete print and flags uncertainty.

## Validation

Image tests cover corner validation, identity pixel preservation, removing surrounding borders, derivative rotation, unchanged original hashes and both configured provider transports. Production browser coverage exercises mobile and desktop editing, manual keyboard corners, unavailable AI, save/reopen/restore, invalid and stale saves, private access, regeneration retaining edits, batch confident/uncertain suggestions, acceptance and reopening a saved crop. Browser AI suggestions use synthetic fixtures; recognition quality still requires reviewing real scans. The packaged worker is tested separately with framing enabled. Physical iPhone corner dragging remains an acceptance check.
