# Publishing idempotency

ClipFlow gives each publishing destination a deterministic queue job ID:

`publish-${targetId}`

The worker also claims a destination with a conditional database update from `QUEUED` to `PUBLISHING`. Only the delivery that changes exactly one row may continue with the provider upload. Duplicate queue deliveries, retries arriving after a successful claim, and already-published targets therefore cannot start a second upload through the same target claim.

The queue job ID prevents duplicate enqueue operations from creating independent jobs, while the database claim protects the publishing state even if duplicate deliveries reach the worker. Both protections are intentional: queue-level deduplication is not a substitute for an atomic database state transition.

A target that has already moved beyond `QUEUED` must be reconciled through its persisted publishing state and attempt history rather than claimed again.
