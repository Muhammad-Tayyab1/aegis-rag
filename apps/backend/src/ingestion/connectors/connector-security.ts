import { createDecipheriv } from "node:crypto";

export function isReadOnlySelect(query?: string) {
  return Boolean(
    query &&
    /^select\s/i.test(query.trim()) &&
    !/;|\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b/i.test(
      query,
    ),
  );
}

export function connectorKey() {
  const value = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("CONNECTOR_ENCRYPTION_KEY must be 32 bytes encoded as hex");
  return Buffer.from(value, "hex");
}

export function decryptConnectorSecret(value: string) {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", connectorKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
