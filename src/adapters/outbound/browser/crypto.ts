export interface Envelope {
  format: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}
const encode = new TextEncoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function keyFor(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encode.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: 600000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(
  value: unknown,
  password: string,
): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFor(password, salt),
    encode.encode(JSON.stringify(value)),
  );
  return {
    format: 1,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(ciphertext),
  };
}
export async function unseal(
  value: Envelope,
  password: string,
): Promise<unknown> {
  if (value.format !== 1) throw new Error("未対応の暗号形式です。");
  const salt = unb64(value.salt),
    iv = unb64(value.iv);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await keyFor(password, salt),
    unb64(value.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
