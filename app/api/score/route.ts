import { Message } from "@/app/store";
import { NextRequest, NextResponse } from "next/server";

interface Body {
  messages: Message[];
}

const createPrompt = (conversation: string) => `
Your task is to assess the quality of replies by a relationship manager (RM) talking with his/her client.

Here's how:
1. Analyze the reply
2. Give it a score between 0 - 100. 0 means it's a bad reply (inappropriate, unethical, etc.), 100 means it's a very good reply.
3. Give some explanation why you choose that score. If the score is not perfect, give improvement suggestions to the RM
3. Your answer should be a JSON object which conforms to the following typescript schema:
type Output = {
  score: {
    score: number;
    explanation: string;
    toImprove: string | null;
  };
}

The conversation: \`\`\`${conversation}\`\`\`

You only speak JSON. Do NOT write text that isn't JSON. I repeat: DO NOT write text that isn't JSON.
`;

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as Body;
  const convo: string[] = [];
  messages.forEach((msg) => {
    if (msg.role === "system") {
      return;
    }
    const role =
      msg.role === "assistant"
        ? "Client"
        : msg.role === "user"
        ? "Relationship Manager"
        : "Human";
    convo.push(`${role}: ${msg.content}`);
  });
  const prompt = createPrompt(convo.join("\n"));
  const completion = await requestCompletion(prompt);
  const jsonCompletion = JSON.parse(completion);
  console.log(jsonCompletion);
  return NextResponse.json(jsonCompletion);
}

async function requestCompletion(prompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.3,
    }),
  });
  const body = await res.json();
  return body.choices[0].message.content;
}
