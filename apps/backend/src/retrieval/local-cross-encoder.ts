const defaultModel = "Xenova/ms-marco-MiniLM-L-6-v2";
type Components = { tokenizer: any; model: any };
let components: Promise<Components> | undefined;

// Keep the ESM-only transformer runtime lazy so Nest's CommonJS build and Jest
// can load retrieval code without evaluating it during startup.
const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;

async function load() {
  components ??= (async () => {
    const modelId = process.env.LOCAL_RERANK_MODEL ?? defaultModel;
    const { AutoModelForSequenceClassification, AutoTokenizer } =
      await nativeImport("@xenova/transformers");
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId),
      AutoModelForSequenceClassification.from_pretrained(modelId),
    ]);
    return { tokenizer, model };
  })();
  return components;
}

export async function crossEncoderScores(query: string, documents: string[]) {
  const { tokenizer, model } = await load();
  return Promise.all(
    documents.map(async (document) => {
      const inputs = tokenizer(query, {
        text_pair: document,
        truncation: true,
        padding: true,
      });
      const output = await model(inputs);
      return Number(output.logits.data[output.logits.data.length - 1]);
    }),
  );
}
