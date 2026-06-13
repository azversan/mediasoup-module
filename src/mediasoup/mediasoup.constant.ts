import { types } from 'mediasoup';

/**
 * Worker log tags
 */
export const workerLogTags: types.WorkerLogTag[] = ['bwe', 'dtls', 'ice', 'info', 'message', 'rtcp', 'rtp', 'rtx', 'score', 'sctp', 'simulcast', 'srtp', 'svc'];

/**
 * Worker log levels
 */
export const workerLogLevels: types.WorkerLogLevel[] = ['debug', 'error', 'none', 'warn'];

/**
 * Transport types
 */
export const transportTypes: types.TransportType[] = ['direct', 'pipe', 'plain', 'webrtc'];

/**
 * Media kind
 */
export const mediaKinds: types.MediaKind[] = ['audio', 'video'];

/**
 * DTLS roles
 */
export const dtlsRoles: types.DtlsRole[] = ['auto', 'client', 'server'];

/**
 * Fingerprint algorithms
 */
export const fingerprintAlgorithms: types.FingerprintAlgorithm[] = ['sha-1', 'sha-224', 'sha-256', 'sha-384', 'sha-512'];
