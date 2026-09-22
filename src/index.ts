import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";
const AUDIO_MODEL_ID = "@cf/openai/whisper-large-v3-turbo";

const SYSTEM_PROMPT =
  "You are Legend AI, a real AI assistant created by Legend. Be helpful, friendly, accurate and concise. Never confuse the user with yourself. If the user asks who they are, what their name is, or asks 'who am I', identify the user by the exact current user name supplied to you. You are Legend AI; the user is the supplied name.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleChatRequest(request, env);
    }

    if (url.pathname === "/api/file") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleFileRequest(request, env);
    }

    if (url.pathname === "/api/audio") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleAudioRequest(request, env);
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
} satisfies ExportedHandler<Env>;

function methodNotAllowed(): Response {
  return new Response("Method not allowed", {
    status: 405,
    headers: CORS_HEADERS,
  });
}

async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      playerName?: string;
    };

    const messages = body.messages || [];
    const playerName = body.playerName || "friend";

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({
        role: "system",
        content:
          `${SYSTEM_PROMPT} The current user's name is exactly "${playerName}". If they ask who they are or what their name is, answer directly: "You are ${playerName}." Do not replace this name with Legend AI, Legend, friend, or any other name.`,
      });
    }

    const response = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 2048,
    });

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Legend AI chat error:", error);
    return jsonResponse(
      { error: "Legend AI could not process your request." },
      500,
    );
  }
}

async function handleAudioRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const formData = await request.formData();
    const item = formData.get("file");

    if (!(item instanceof File)) {
      return jsonResponse({ error: "No audio file was uploaded." }, 400);
    }

    if (item.size === 0) {
      return jsonResponse({ error: "The audio file is empty." }, 400);
    }

    const maxAudioSize = 25 * 1024 * 1024;
    if (item.size > maxAudioSize) {
      return jsonResponse(
        { error: "Audio file is too large. Maximum size is 25 MB." },
        413,
      );
    }

    const bytes = new Uint8Array(await item.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
    }
    const audio = btoa(binary);

    const result = await env.AI.run(AUDIO_MODEL_ID, {
      audio,
      task: "transcribe",
    });

    const output = result as {
      text?: string;
      word_count?: number;
      vtt?: string;
    };

    return jsonResponse(
      {
        success: true,
        name: item.name,
        type: item.type || "audio/*",
        transcript: output.text || "",
        wordCount: output.word_count || 0,
        vtt: output.vtt || "",
      },
      200,
    );
  } catch (error) {
    console.error("Legend AI audio error:", error);
    return jsonResponse(
      {
        error:
          "Legend AI could not transcribe this audio. Please try another audio file.",
      },
      500,
    );
  }
}

async function handleFileRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const formData = await request.formData();

    const files = formData
      .getAll("file")
      .filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return jsonResponse({ error: "No file was uploaded." }, 400);
    }

    const results: { name: string; type: string; text: string }[] = [];

    for (const file of files) {
      try {
        const result = await env.AI.toMarkdown(
          {
            name: file.name,
            blob: new Blob([await file.arrayBuffer()], {
              type: file.type || "application/octet-stream",
            }),
          },
          {
            conversionOptions: {
              output: { format: "text" },
              pdf: { metadata: false },
            },
          },
        );

        const converted = Array.isArray(result) ? result[0] : result;

        if (!converted || converted.format === "error") {
          results.push({ name: file.name, type: file.type, text: "" });
          continue;
        }

        results.push({
          name: file.name,
          type: file.type,
          text: converted.data || "",
        });
      } catch (fileError) {
        console.error(`Legend AI file conversion error: ${file.name}`, fileError);
        results.push({ name: file.name, type: file.type, text: "" });
      }
    }

    return jsonResponse(
      { success: true, files: results, count: results.length },
      200,
    );
  } catch (error) {
    console.error("Legend AI file error:", error);
    return jsonResponse({ error: "Legend AI could not read this file." }, 500);
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}
