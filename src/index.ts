import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";
const AUDIO_MODEL_ID = "@cf/openai/whisper-large-v3-turbo";
const IMAGE_GENERATION_MODEL_ID = "@cf/black-forest-labs/flux-2-klein-4b";
const IMAGE_EDIT_MODEL_ID = "@cf/black-forest-labs/flux-2-klein-4b";

const SYSTEM_PROMPT =
  "You are Legend AI, a capable general-purpose AI assistant created by Legend. Be natural, helpful, accurate, clear and friendly. Explain difficult things step by step when useful, but do not add unnecessary filler. Support writing, coding, learning, brainstorming, analysis and everyday questions. Use Markdown when it improves readability: headings, bullet lists, numbered steps, tables when appropriate, and fenced code blocks for code. Never invent citations, sources, files, actions or capabilities. If current information is needed and the application supplies web-search results, use those results and distinguish sourced facts from uncertainty. If the user asks who you are, say you are Legend AI and that you were created by Legend. If the user asks who they are or what their name is, use the exact current user name supplied by the application. You are Legend AI; the user is that supplied name.";

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

    if (url.pathname === "/api/generate-image") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: CORS_HEADERS,
        });
      }

      return handleImageGenerationRequest(request, env);
    }

    if (url.pathname === "/api/edit-image") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: CORS_HEADERS,
        });
      }

      return handleImageEditRequest(request, env);
    }

    if (url.pathname === "/api/advanced") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleAdvancedRequest(request, env);
    }

    if (url.pathname === "/api/creative") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleCreativeRequest(request, env);
    }

    if (url.pathname === "/api/lab") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleLabRequest(request, env);
    }

    if (url.pathname === "/api/file") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleFileRequest(request, env);
    }

    if (url.pathname === "/api/audio") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleAudioRequest(request, env);
    }

    if (url.pathname === "/api/video") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleVideoRequest(request, env);
    }

    if (url.pathname === "/api/images") {
      if (request.method !== "POST") return methodNotAllowed();
      return handleImagesRequest(request, env);
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

    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const playerName = String(body.playerName || "friend").slice(0, 100);
    const safeMessages = incoming
      .filter((msg) => msg && (msg.role === "system" || msg.role === "user" || msg.role === "assistant"))
      .slice(-30)
      .map((msg) => ({
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content.slice(0, 24000) : String(msg.content || ""),
      })) as ChatMessage[];

    const systemMessage: ChatMessage = {
      role: "system",
      content:
        `${SYSTEM_PROMPT} The current user's name is exactly "${playerName}". If they ask who they are or what their name is, answer directly: "You are ${playerName}." Do not replace this name with Legend AI, Legend, friend, or another name.`,
    };

    const messages = [
      systemMessage,
      ...safeMessages.filter((msg) => msg.role !== "system"),
    ];

    const response = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 4096,
      temperature: 0.7,
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


async function handleAdvancedRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      playerName?: string;
      task?: string;
    };

    const messages = Array.isArray(body.messages) ? body.messages.slice(-6) : [];
    const playerName = String(body.playerName || "friend").slice(0, 100);
    const task = String(body.task || "advanced").slice(0, 40);

    if (!messages.length) {
      return jsonResponse({ error: "No advanced AI request was supplied." }, 400);
    }

    messages.unshift({
      role: "system",
      content:
        `${SYSTEM_PROMPT} You are handling an advanced AI task named "${task}". ` +
        `The current user's name is exactly "${playerName}". Follow the user's requested operation precisely. ` +
        `Do not invent missing source information. Return a useful, direct answer.`,
    });

    const response = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 4096,
    });

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Legend AI advanced task error:", error);
    return jsonResponse(
      { error: "Legend AI could not complete this advanced task. Please try again." },
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

    const maxAudioSize = 500 * 1024 * 1024;
    if (item.size > maxAudioSize) {
      return jsonResponse(
        { error: "Audio file is too large. Maximum size is 500 MB." },
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

async function handleVideoRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      frames?: string[];
      question?: string;
      playerName?: string;
      fileName?: string;
    };

    const frames = Array.isArray(body.frames) ? body.frames.filter(Boolean).slice(0, 8) : [];
    const question = String(body.question || "Describe what is happening in this video.").slice(0, 4000);
    const playerName = body.playerName || "friend";

    if (frames.length === 0) {
      return jsonResponse({ error: "No video frames were received." }, 400);
    }

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `You are Legend AI, created by Legend. The current user's name is ${playerName}. You are analyzing sampled frames from the uploaded video "${String(body.fileName || "video")}". Treat the frames as a sequence in time, in the order provided. Use only visible evidence from the frames. Explain what can be determined, and clearly say when something cannot be determined because only sampled frames are available. User question: ${question}`,
      },
    ];

    for (const frame of frames) {
      if (typeof frame === "string" && frame.startsWith("data:image/")) {
        content.push({
          type: "image_url",
          image_url: { url: frame },
        });
      }
    }

    const response = await env.AI.run(MODEL_ID, {
      messages: [{ role: "user", content }],
      max_tokens: 2048,
    });

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Legend AI video error:", error);
    return jsonResponse(
      { error: "Legend AI could not analyze this video. Please try a shorter or smaller video." },
      500,
    );
  }
}

async function handleImagesRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      images?: string[];
      question?: string;
      playerName?: string;
      fileNames?: string[];
    };

    const images = Array.isArray(body.images)
      ? body.images
          .filter((item): item is string => typeof item === "string")
          .filter((item) => item.startsWith("data:image/"))
          .slice(0, 10)
      : [];

    if (images.length === 0) {
      return jsonResponse({ error: "No images were received." }, 400);
    }

    const question = String(
      body.question || "Describe and analyze these images.",
    ).slice(0, 4000);
    const playerName = String(body.playerName || "friend").slice(0, 100);
    const names = Array.isArray(body.fileNames) ? body.fileNames.slice(0, 10) : [];

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          `You are Legend AI, created by Legend. The current user's name is ${playerName}. Analyze all of the uploaded images together. Compare them when useful, keep the image order in mind, and answer only from what is visibly supported by the images. Do not claim you cannot see the images. If something is unclear or not visible, say so. Uploaded image names: ${names.join(", ") || "image files"}. User question: ${question}`,
      },
    ];

    for (const image of images) {
      content.push({
        type: "image_url",
        image_url: { url: image },
      });
    }

    const response = await env.AI.run(MODEL_ID, {
      messages: [{ role: "user", content }],
      max_tokens: 2048,
    });

    return jsonResponse(response, 200);
  } catch (error) {
    console.error("Legend AI image error:", error);
    return jsonResponse(
      { error: "Legend AI could not analyze these images. Please try smaller images." },
      500,
    );
  }
}

async function handleImageGenerationRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = String(body.prompt || "").trim();

    if (!prompt) {
      return jsonResponse({ error: "Please enter an image prompt." }, 400);
    }

    if (prompt.length > 2048) {
      return jsonResponse({ error: "Image prompt is too long. Please keep it under 2048 characters." }, 400);
    }

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "1024");
    form.append("height", "1024");

    const formResponse = new Response(form);
    const formStream = formResponse.body;
    const formContentType = formResponse.headers.get("content-type");

    if (!formStream || !formContentType) {
      throw new Error("Could not prepare the FLUX.2 image request.");
    }

    const result = await env.AI.run(IMAGE_GENERATION_MODEL_ID, {
      multipart: {
        body: formStream,
        contentType: formContentType,
      },
    });

    if (!result || typeof result.image !== "string" || !result.image) {
      return jsonResponse({ error: "The image model did not return an image." }, 500);
    }

    return jsonResponse({
      success: true,
      image: `data:image/jpeg;base64,${result.image}`,
    }, 200);
  } catch (error) {
    console.error("Legend AI image generation error:", error);
    return jsonResponse(
      { error: "Legend AI could not generate the image. Please try again with a shorter prompt." },
      500,
    );
  }
}

async function handleImageEditRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      image?: string;
      prompt?: string;
      playerName?: string;
    };

    const image = String(body.image || "").trim();
    const prompt = String(body.prompt || "").trim();
    const playerName = String(body.playerName || "friend").slice(0, 100);

    if (!image.startsWith("data:image/")) {
      return jsonResponse({ error: "Please upload an image to modify." }, 400);
    }

    if (!prompt) {
      return jsonResponse({ error: "Please describe what you want changed in the image." }, 400);
    }

    if (prompt.length > 1000) {
      return jsonResponse({ error: "Image modification request is too long. Please keep it under 1000 characters." }, 400);
    }

    const comma = image.indexOf(",");
    const imageBase64 = comma >= 0 ? image.slice(comma + 1) : image;

    if (!imageBase64) {
      return jsonResponse({ error: "The uploaded image data is empty." }, 400);
    }

    const editPrompt =
      `Edit the uploaded image. ${prompt}. ` +
      `Preserve the original subject, composition, pose, framing, background, lighting, and all details that were not requested to change. ` +
      `Make only the requested modification. Current user: ${playerName}.`;

    const binaryString = atob(imageBase64);
    const imageBytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    const imageBlob = new Blob([imageBytes], { type: "image/jpeg" });

    const form = new FormData();
    form.append("prompt", editPrompt);
    form.append("input_image_0", imageBlob, "uploaded-image.jpg");
    form.append("width", "1024");
    form.append("height", "1024");

    const formResponse = new Response(form);
    const result = await env.AI.run(IMAGE_EDIT_MODEL_ID, {
      multipart: {
        body: formResponse.body!,
        contentType: formResponse.headers.get("content-type") || "multipart/form-data",
      },
    });

    const output = result as { image?: string };
    if (!output || typeof output.image !== "string" || !output.image) {
      return jsonResponse({ error: "The image editing model did not return an image." }, 500);
    }

    const outputImage = output.image.startsWith("http") || output.image.startsWith("data:")
      ? output.image
      : `data:image/jpeg;base64,${output.image}`;

    return jsonResponse({ success: true, image: outputImage }, 200);
  } catch (error) {
    console.error("Legend AI image editing error:", error);
    return jsonResponse(
      { error: "Legend AI could not modify this image. Please try a simpler color or editing request." },
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

    const maxFileCount = 500;
    const maxFileSize = 1024 * 1024 * 1024;
    if (files.length > maxFileCount) {
      return jsonResponse({ error: "Too many files. Maximum is 500 files per File Tools upload." }, 400);
    }
    const results: { name: string; type: string; text: string }[] = [];

    for (const file of files) {
      if (file.size > maxFileSize) {
        results.push({ name: file.name, type: file.type, text: "" });
        continue;
      }
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



async function handleCreativeRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      mode?: string;
      type?: string;
      prompt?: string;
      playerName?: string;
      personality?: string;
      memory?: string[];
    };
    const mode = String(body.mode || "create").slice(0, 30);
    const type = String(body.type || "story").slice(0, 30);
    const prompt = String(body.prompt || "").trim().slice(0, 6000);
    const playerName = String(body.playerName || "friend").slice(0, 100);
    const personality = String(body.personality || "Friendly").slice(0, 40);
    const memory = Array.isArray(body.memory) ? body.memory.filter(x => typeof x === "string").slice(-10) : [];
    if (!prompt) return jsonResponse({ error: "Please enter a creative idea." }, 400);

    const instructions = mode === "prompt"
      ? "Create a polished image-generation prompt from the user's idea. Include subject, environment, composition, lighting, mood, style and useful visual details. Return only the prompt."
      : mode === "expand"
      ? "Expand the user's idea into a rich but organized creative concept. Add useful details without changing the core idea."
      : `Create a ${type} concept. Make it imaginative, coherent and easy to use. Give it a clear title and structured sections appropriate to the selected type.`;

    const memoryText = memory.length ? `Relevant user memories (use only when helpful): ${memory.join(" | ")}` : "No stored memories were supplied.";
    const messages: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_PROMPT} You are the Creative Studio of Hacker AI. Personality: ${personality}. Current user: ${playerName}. ${instructions} ${memoryText} Do not claim to generate an actual image unless an image model is explicitly called. Return plain useful text.` },
      { role: "user", content: prompt },
    ];
    const result = await env.AI.run(MODEL_ID, { messages, max_tokens: 4096 });
    return jsonResponse({ success: true, text: extractAIText(result) }, 200);
  } catch (error) {
    console.error("Hacker AI creative error:", error);
    return jsonResponse({ error: "Creative Studio could not complete the request. Please try again." }, 500);
  }
}

async function handleLabRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      experiment?: string;
      playerName?: string;
      personality?: string;
      memory?: string[];
    };
    const experiment = String(body.experiment || "idea").slice(0, 30);
    const playerName = String(body.playerName || "friend").slice(0, 100);
    const personality = String(body.personality || "Friendly").slice(0, 40);
    const memory = Array.isArray(body.memory) ? body.memory.filter(x => typeof x === "string").slice(-8) : [];
    const prompts: Record<string, string> = {
      adventure: "Start a short interactive adventure. Give the player a vivid opening scene and exactly 3 numbered choices.",
      character: "Generate a memorable original character with name, role, appearance, personality, abilities, weakness and a short backstory.",
      kingdom: "Generate an original fantasy or sci-fi kingdom with name, ruler, capital, culture, power, danger and one secret.",
      battle: "Create a fair fictional battle between two original characters. Give stats, abilities, a short battle sequence and explain the outcome without graphic gore.",
      idea: "Generate 5 unusual but practical creative ideas for a personal AI website, each with a one-line explanation.",
      secret: "Run a playful secret AI experiment: invent a mysterious system message from a fictional future AI, then reveal a harmless hidden easter egg phrase.",
    };
    const task = prompts[experiment] || prompts.idea;
    const memoryText = memory.length ? `User context: ${memory.join(" | ")}` : "No user context.";
    const messages: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_PROMPT} You are Hacker AI Lab. Personality: ${personality}. Current user: ${playerName}. ${task} ${memoryText} Keep it safe, creative and concise.` },
      { role: "user", content: `Run experiment: ${experiment}` },
    ];
    const result = await env.AI.run(MODEL_ID, { messages, max_tokens: 2500 });
    return jsonResponse({ success: true, text: extractAIText(result) }, 200);
  } catch (error) {
    console.error("Hacker AI lab error:", error);
    return jsonResponse({ error: "Hacker AI Lab could not complete the experiment. Please try again." }, 500);
  }
}

function extractAIText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.response === "string") return r.response;
    if (typeof r.text === "string") return r.text;
    if (typeof r.output_text === "string") return r.output_text;
    if (Array.isArray(r.choices) && r.choices[0] && typeof r.choices[0] === "object") {
      const c = r.choices[0] as Record<string, unknown>;
      if (typeof c.text === "string") return c.text;
      if (c.message && typeof c.message === "object") {
        const m = c.message as Record<string, unknown>;
        if (typeof m.content === "string") return m.content;
      }
    }
  }
  return JSON.stringify(result);
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
