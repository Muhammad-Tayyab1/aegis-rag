export const SUPPORTED_EMBEDDING_MODEL = "aegis-hash-384";

export function embed(text: string, model = SUPPORTED_EMBEDDING_MODEL) {
  if (model !== SUPPORTED_EMBEDDING_MODEL)
    throw new Error(`Unsupported embedding model: ${model}`);
  const vector = Array(384).fill(0);
  for (let index = 0; index < text.length; index++)
    vector[(text.charCodeAt(index) * 31 + index) % 384] +=
      (text.charCodeAt(index) % 17) / 17;
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}
