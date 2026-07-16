# Room chat

The room header places Chat directly after Requests with the same quiet button treatment and a Runtime-derived private unread badge capped visually at `99+`. Chat opens the existing right production sidebar, selects its Chat rail section, restores a hidden right sidebar to collapsed state, and uses the established temporary expansion/pinning behavior. It never opens a floating drawer or changes the left sidebar.

The Private tab renders bounded canonical history, sender identity, linked-account indication, multiline plain text, timestamps, own-message treatment, deletion tombstones, earlier-history loading, near-bottom autoscroll, and a new-message affordance. Enter sends, Shift+Enter inserts a line, failed sends retain their idempotency key for retry, and canonical Runtime responses reconcile the list. Opening the visible Private tab advances the Runtime read cursor; cursor-write failure does not block reading or sending.

The same Runtime-owned chat is available to current Backstage and on-Stage guests through the existing mirrored right-sidebar contract. Chat UI state never becomes room authority, stores no chat credentials, and does not remount Stage or RealtimeKit media.

The Public tab is a connection and capability foundation. It renders the Runtime provider registry, safe actor state, Read/Send/Foundation-only capability chips, verified existing Twitch/Kick connection links, Custom RTMP unsupported state, an empty combined-feed region, and a disabled composer. It contains no sample platform messages and makes no outbound provider request. Per-actor identities and all credentials remain Runtime/Auth-owned; unsupported OAuth, especially Rumble, is not invented.

Studio remains OFF AIR. Public feed ingestion, outbound provider messages, provider moderation, provider disconnect transport, custom RTMP chat, attachments, reactions, webhooks, recording, broadcast output, LiveKit, and Egress remain deferred.
