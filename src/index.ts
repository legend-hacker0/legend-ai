import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

const SYSTEM_PROMPT =
  "You are Legend AI. You were created by Legend. Be helpful, friendly, accurate and concise.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: CORS_HEADERS,
        });
      }

      return handleChatRequest(request, env);
    }

    if (url.pathname === "/api/file") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: CORS_HEADERS,
        });
      }

      return handleFileRequest(request, env);
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", {
      status: 404,
      headers: CORS_HEADERS,
    });
  },
} satisfies ExportedHandler<Env>;

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
          `${SYSTEM_PROMPT} The current user's name is ${playerName}. If they ask who they are, tell them they are ${playerName} in a warm and beautiful way.`,
      });
    }

    const response = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 2048,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Legend AI chat error:", error);

    return new Response(
      JSON.stringify({
        error: "Legend AI could not process your request.",
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  }
}

async function handleFileRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const formData = await request.formData();
const files = formData.getAll("file").filter(
  (item): item is File => item instanceof File
);

if (files.length === 0) {
  return new Response(
    JSON.stringify({
      error: "No file was uploaded.",
    }),
    {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    },
  );
}

    const result = await env.AI.toMarkdown(
  {
    name: file.name,
    blob: new Blob([await file.arrayBuffer()], {
      type: file.type || "application/octet-stream",
    }),
  },
  {
    conversionOptions: {
      output: {
        format: "text",
      },
      pdf: {
        metadata: false,
      },
    },
  },
);

    const converted = Array.isArray(result) ? result[0] : result;

    if (!converted || converted.format === "error") {
      return new Response(
        JSON.stringify({
          error:
            converted?.error ||
            "Legend AI could not read this file.",
        }),
        {
          status: 400,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        name: file.name,
        type: file.type,
        text: converted.data || "",
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Legend AI file error:", error);

    return new Response(
      JSON.stringify({
        error: "Legend AI could not read this file.",
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  }
}
