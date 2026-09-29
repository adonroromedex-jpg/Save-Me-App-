// Encrypted transfers use 1 MiB objects, compatible with the 50 MiB bucket limit.
// This is a per-media safety cap, not a subscription or duration limit.
export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
export const MEDIA_LIMIT_LABEL = '200 MB';
export const MAX_VIDEO_SECONDS = 180;
