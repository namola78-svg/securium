import { createMcpACore, McpAError, MCPA_RESOURCE_URIS, MCPA_TOOL_NAMES, type McpACore } from "./mcpa-core.ts";

export type McpARequest = Readonly<{
  jsonrpc?: "2.0";
  id?: string | number | null;
  method: string;
  params?: Readonly<Record<string, unknown>>;
}>;

export type McpAResponse = Readonly<Record<string, unknown>>;

function result(id: McpARequest["id"], value: unknown): McpAResponse {
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}

function error(id: McpARequest["id"], code: string, message: string): McpAResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function asDetail(value: unknown) {
  return value === "DETAIL" ? "DETAIL" as const : "SUMMARY" as const;
}

function asSearchInput(value: unknown) {
  const params = (value ?? {}) as Record<string, unknown>;
  return {
    text: typeof params.text === "string" ? params.text : undefined,
    entityType: params.entityType as "Course" | "Lesson" | "Question" | undefined,
    courseKey: typeof params.courseKey === "string" ? params.courseKey : undefined,
    publicationStatus: params.publicationStatus === undefined ? "PUBLISHED" as const : params.publicationStatus as "PUBLISHED",
    limit: typeof params.limit === "number" ? params.limit : undefined,
    cursor: typeof params.cursor === "string" ? params.cursor : undefined,
    detail: asDetail(params.detail),
  };
}

export function createMcpARequestHandler(core: McpACore) {
  return async function handle(request: McpARequest): Promise<McpAResponse> {
    try {
      if (request.jsonrpc !== undefined && request.jsonrpc !== "2.0") return error(request.id, "INVALID_REQUEST", "Only JSON-RPC 2.0 is supported.");
      switch (request.method) {
        case "initialize":
          return result(request.id, { protocolVersion: "2025-06-18", capabilities: { resources: { read: true }, tools: { list: true, call: true } }, serverInfo: { name: "securium-mcpa", version: "MCPA_V1" } });
        case "ping":
          return result(request.id, {});
        case "resources/list":
          return result(request.id, { resources: MCPA_RESOURCE_URIS.map((uri) => ({ uri, name: uri.includes("lessons") ? "Published lesson" : "Published course", description: "Published canonical Securium content" })) });
        case "resources/read": {
          const uri = typeof request.params?.uri === "string" ? request.params.uri : "";
          const courseMatch = /^securium:\/\/courses\/([^/]+)$/.exec(uri);
          if (courseMatch) return result(request.id, { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(await core.getCourse(decodeURIComponent(courseMatch[1]), "DETAIL")) }] });
          const lessonMatch = /^securium:\/\/courses\/([^/]+)\/lessons\/(.+)$/.exec(uri);
          if (lessonMatch) return result(request.id, { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(await core.getLesson(decodeURIComponent(lessonMatch[1]), decodeURIComponent(lessonMatch[2]), "DETAIL")) }] });
          return error(request.id, "NOT_FOUND", "Resource was not found.");
        }
        case "tools/list":
          return result(request.id, { tools: MCPA_TOOL_NAMES.map((name) => ({ name, description: name === "search_learning_content" ? "Search published Course, Lesson, and Question content." : "Read one published Question without answer keys or explanations." })) });
        case "tools/call": {
          const name = typeof request.params?.name === "string" ? request.params.name : "";
          const args = request.params?.arguments;
          if (name === "search_learning_content") return result(request.id, { content: [{ type: "json", json: await core.search(asSearchInput(args)) }] });
          if (name === "get_question") {
            const questionKey = (args as Record<string, unknown> | undefined)?.stableKey;
            if (typeof questionKey !== "string") return error(request.id, "NOT_FOUND", "Question stableKey is required.");
            return result(request.id, { content: [{ type: "json", json: await core.getQuestion(questionKey, asDetail((args as Record<string, unknown> | undefined)?.detail)) }] });
          }
          return error(request.id, "NOT_FOUND", "Tool was not found.");
        }
        default:
          return error(request.id, "NOT_FOUND", "Method was not found.");
      }
    } catch (caught) {
      if (caught instanceof McpAError) return error(request.id, caught.code, caught.message);
      return error(request.id, "GOVERNANCE_BLOCKED", "MCP-A request could not be completed.");
    }
  };
}

export async function createEnabledLocalMcpAHandler() {
  const { createMcpAReadService } = await import("./mcpa-read-service.ts");
  return createMcpARequestHandler(createMcpACore(createMcpAReadService()));
}

export async function runLocalStdioMcpAAdapter() {
  if (process.env.SECURIUM_MCPA_ENABLE !== "1") return;
  const handle = await createEnabledLocalMcpAHandler();
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let request: McpARequest;
      try {
        request = JSON.parse(line) as McpARequest;
      } catch {
        process.stdout.write(`${JSON.stringify(error(null, "GOVERNANCE_BLOCKED", "Request was not valid JSON."))}\n`);
        continue;
      }
      void handle(request).then((response) => process.stdout.write(`${JSON.stringify(response)}\n`));
    }
  });
}

if (process.env.SECURIUM_MCPA_ENABLE === "1" && process.argv[1]?.endsWith("mcpa-adapter.ts")) void runLocalStdioMcpAAdapter();
