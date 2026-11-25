# Core security and media regression coverage

The core regression suite covers two boundaries that must be enforced before content reaches the publishing pipeline.

## Password handling

Password hashing uses a per-password salt and a one-way password hash. Regression tests verify that independently generated hashes are salted, the correct password verifies, an incorrect password does not verify, and malformed stored hash values are rejected safely.

## Media validation

The upload validation helper checks the declared MIME type, file size and file signature before accepting an upload. Tests cover supported video and image formats, the 100 MB limit, valid signatures, truncated content, mismatched signatures and unsupported formats.

These tests exercise the production helpers used by the upload flow; they do not replace live storage-permission or browser upload checks in staging.
