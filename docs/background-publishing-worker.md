# Background publishing worker

ClipFlow keeps scheduled publishing work outside the web request lifecycle. The web app scans due posts and enqueues one deterministic job for each destination. The worker consumes those jobs and records each destination's state and publishing-attempt history independently.

## Runtime

- Start the worker with `npm run worker:publish`.
- Provide the same PostgreSQL and Redis connection settings used by the web app.
- Keep Redis persistence enabled for the queue.
- Keep `CLIPFLOW_PUBLISHING_ENABLED=false` until a provider adapter and its live staging flow have been verified.
- In a single-service staging deployment, `RUN_PUBLISHING_WORKER=true` starts the worker alongside the web process; leave it false for the initial OAuth and media checks.

## Recovery and retries

Transient failures use bounded exponential retries. Permanent provider or credential failures stop immediately. A worker interruption leaves the provider outcome uncertain, so the stale target is marked for reconciliation rather than blindly re-uploaded. Check the destination account before manually retrying an uncertain publication.

Run one worker replica for the first staging upload. Increase concurrency or replicas only after the queue, database claim, provider idempotency and media storage behaviour have been verified under controlled tests.
