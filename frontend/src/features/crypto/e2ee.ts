const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type EncryptedPayload = {
  cipherText: string;
  iv: string;
};

export async function getKeyFingerprint(passphrase: string, roomId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${roomId}:${passphrase}`)
  );
  const bytes = new Uint8Array(digest).slice(0, 8);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(":");
}

export async function deriveRoomKey(passphrase: string, roomId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`asa-meet-net:${roomId}`),
      iterations: 210000,
      hash: "SHA-256",
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key: CryptoKey, plainText: string): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText)
  );

  return {
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptText(
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<string> {
  const ivBytes = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.cipherText);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as unknown as BufferSource },
    key,
    cipherBytes as unknown as BufferSource
  );
  return decoder.decode(plainBuffer);
}

export async function encryptBytes(
  key: CryptoKey,
  plainBytes: Uint8Array
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes as unknown as BufferSource
  );
  return {
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptBytes(
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<Uint8Array> {
  const ivBytes = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.cipherText);
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as unknown as BufferSource },
    key,
    cipherBytes as unknown as BufferSource
  );
  return new Uint8Array(plainBuffer);
}

function bytesToBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
