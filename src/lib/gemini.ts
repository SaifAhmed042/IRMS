const KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '';
const MODEL = 'gemini-1.5-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const geminiAvailable = () => Boolean(KEY);

async function callGemini(parts: unknown[]): Promise<string> {
  if (!KEY) return '';
  try {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    if (!res.ok) return '';
    const json = await res.json();
    const text: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return (text ?? '').trim();
  } catch {
    return '';
  }
}

export async function explainDecision(input: {
  train_no: string;
  train_type: string;
  current_speed: number;
  recommended_speed: number;
  action: string;
  reason: string;
  weather: string;
  incident: string;
}): Promise<string> {
  const prompt = `You are an assistant for a train loco pilot. Explain in one short sentence (max 25 words), simple language, why the train should ${input.action.toLowerCase()}. Context: ${JSON.stringify(input)}. Do not greet or add preamble.`;
  return callGemini([{ text: prompt }]);
}

export async function classifyIncidentImage(imageBase64: string, mime: string): Promise<string> {
  const prompt = `Analyze this railway track image and classify the issue. Reply with EXACTLY ONE word from this list: obstruction, damage, animal, flood, unknown.`;
  const text = await callGemini([
    { text: prompt },
    { inline_data: { mime_type: mime, data: imageBase64 } },
  ]);
  const word = text.toLowerCase().replace(/[^a-z]/g, '');
  if (['obstruction', 'damage', 'animal', 'flood', 'unknown'].includes(word)) return word;
  return 'unknown';
}

export async function extractIncidentData(imageBase64: string, mime: string): Promise<{ type: string; description: string; severity: string } | null> {
  const prompt = `Analyze this railway track incident image. Return a raw JSON object with NO markdown formatting, no code blocks, just raw JSON. Use this exact schema:
{
  "type": "obstruction" | "damage" | "animal" | "flood" | "unknown",
  "description": "Short description of what is in the image (max 10 words)",
  "severity": "LOW" | "MEDIUM" | "HIGH"
}`;
  const text = await callGemini([
    { text: prompt },
    { inline_data: { mime_type: mime, data: imageBase64 } },
  ]);
  try {
    const clean = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

export async function smartAlertText(input: {
  type: string;
  severity: string;
  description: string;
  distanceKm?: number;
}): Promise<string> {
  const prompt = `Write a single short safety advisory (max 20 words) for a train loco pilot. Be direct, no preamble. Context: ${JSON.stringify(input)}.`;
  return callGemini([{ text: prompt }]);
}
