/**
 * Edge-safe Web Push (RFC 8291 / RFC 8292) implementation.
 *
 * The `web-push` npm package pulls in `asn1.js` + `safer-buffer`, which call
 * `buffer.hasOwnProperty(...)` at module-evaluation time. In the Cloudflare
 * Worker runtime the `buffer` module namespace has a null prototype, so that
 * throws `TypeError: buffer.hasOwnProperty is not a function` and takes down
 * the ENTIRE server (every page returns 500).
 *
 * This module uses only Web Crypto + fetch, so it is safe to evaluate on the edge.
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface SendPushResult {
  success: boolean
  statusCode: number
  stale: boolean
  error?: string
}

/* ---------------------------------- utils --------------------------------- */

function b64urlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToB64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function u16(n: number): Uint8Array {
  return new Uint8Array([(n >> 8) & 0xff, n & 0xff])
}

function u32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

/* ------------------------------ VAPID (RFC 8292) --------------------------- */

async function importVapidSigningKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const pub = b64urlToBytes(publicKey)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID public key must be a 65-byte uncompressed P-256 point')
  }
  const d = b64urlToBytes(privateKey)
  if (d.length !== 32) {
    throw new Error('VAPID private key must be 32 bytes')
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(d),
    ext: true,
    key_ops: ['sign'],
  }

  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function createVapidAuthHeader(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string,
): Promise<string> {
  const audience = new URL(endpoint).origin
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = bytesToB64url(
    utf8(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  )

  const signingKey = await importVapidSigningKey(publicKey, privateKey)
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      utf8(`${header}.${payload}`) as unknown as BufferSource,
    ),
  )

  const jwt = `${header}.${payload}.${bytesToB64url(signature)}`
  return `vapid t=${jwt}, k=${publicKey}`
}

/* --------------------------- Payload encryption ---------------------------- */

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as unknown as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as unknown as BufferSource, info: info as unknown as BufferSource },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

async function encryptPayload(
  subscription: PushSubscriptionJSON,
  payload: string,
): Promise<Uint8Array> {
  const clientPublic = b64urlToBytes(subscription.keys.p256dh)
  const authSecret = b64urlToBytes(subscription.keys.auth)

  // Ephemeral server ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))

  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublic as unknown as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKeys.privateKey, 256),
  )

  // RFC 8291: IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0"||ua_public||as_public, 32)
  const keyInfo = concat(utf8('WebPush: info\0'), clientPublic, serverPublic)
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32)

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const contentEncryptionKey = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt'],
  )

  // Single record: plaintext || 0x02 delimiter
  const plaintext = concat(utf8(payload), new Uint8Array([0x02]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as unknown as BufferSource, tagLength: 128 },
      aesKey,
      plaintext as unknown as BufferSource,
    ),
  )

  // aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid || ciphertext
  const recordSize = 4096
  return concat(
    salt,
    u32(recordSize),
    new Uint8Array([serverPublic.length]),
    serverPublic,
    ciphertext,
  )
}

/* --------------------------------- sender ---------------------------------- */

export async function sendWebPush(
  subscription: PushSubscriptionJSON,
  payload: string,
  options: {
    vapidPublicKey: string
    vapidPrivateKey: string
    vapidSubject: string
    ttl?: number
    urgency?: 'very-low' | 'low' | 'normal' | 'high'
  },
): Promise<SendPushResult> {
  try {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return { success: false, statusCode: 0, stale: true, error: 'Invalid subscription' }
    }

    const [authorization, body] = await Promise.all([
      createVapidAuthHeader(
        subscription.endpoint,
        options.vapidSubject,
        options.vapidPublicKey,
        options.vapidPrivateKey,
      ),
      encryptPayload(subscription, payload),
    ])

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttl ?? 86400),
        Urgency: options.urgency ?? 'high',
      },
      body: body as BodyInit,
    })

    if (response.ok) {
      return { success: true, statusCode: response.status, stale: false }
    }

    const stale = response.status === 404 || response.status === 410
    let error = ''
    try {
      error = (await response.text()).slice(0, 300)
    } catch {
      error = `HTTP ${response.status}`
    }
    return { success: false, statusCode: response.status, stale, error }
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      stale: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// `u16` is kept for future multi-record support and to document the aes128gcm layout.
void u16
