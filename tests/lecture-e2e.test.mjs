import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";

const port = 33107;
const baseUrl = `http://localhost:${port}`;
const user1 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const user2 = {
  "content-type": "application/json",
  origin: baseUrl,
  "oai-authenticated-user-email": "dev-user-2@example.invalid",
};
const piaFreeLecture = "course-pia-subject-foundation-lecture-01";
const piaPaidLecture = "course-pia-subject-practice-lecture-01";
const ismsPaidLecture = "course-isms-p-subject-practice-lecture-01";
let server;
let output = "";

before(async () => {
  server = spawn(
    process.execPath,
    [
      "node_modules/vinext/dist/cli.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: ".wrangler/wrangler.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Lecture E2E server stopped.\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status > 0) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Lecture E2E server did not start.\n${output}`);
});

after(() => {
  if (server?.exitCode === null) server.kill();
});

async function post(path, headers, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("과정별 강의 목록은 검색·과목·주제 필터와 접근 상태를 표시한다", async () => {
  const response = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment?query=Mock&subjectId=course-pia-subject-foundation&topicId=course-pia-subject-foundation-topic-core`,
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /개인정보 영향평가(?:<!-- -->)? 강의/);
  assert.match(html, /강의 영상/);
  assert.doesNotMatch(html, /Mock 개발용 영상/);
  assert.match(html, /무료/);
  assert.doesNotMatch(html, /허용되지 않은 URL/);
});

test("무료 강의는 수강 전에도 안전한 iframe으로 접근한다", async () => {
  const response = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/${piaFreeLecture}`,
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /무료/);
  assert.match(
    html,
    /https:\/\/www\.youtube-nocookie\.com\/embed\//,
  );
  assert.match(
    html,
    /sandbox="allow-scripts allow-same-origin allow-presentation"/,
  );
  assert.match(
    html,
    /referrerPolicy="strict-origin-when-cross-origin"/,
  );
  assert.doesNotMatch(html, /allow-popups/);
});

test("수강 전용 강의는 수강 사용자만 접근한다", async () => {
  const enrolled = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/${piaPaidLecture}`,
    { headers: user1 },
  );
  assert.equal(enrolled.status, 200);

  const blocked = await fetch(
    `${baseUrl}/lectures/isms-p/${ismsPaidLecture}`,
    { headers: user2, redirect: "manual" },
  );
  assert.equal(blocked.status, 307);
  assert.match(
    blocked.headers.get("location") ?? "",
    /\/courses\/isms-p\?notice=lecture-enrollment-required$/,
  );
});

test("비공개 강의와 허용되지 않은 영상 URL을 노출하지 않는다", async () => {
  const privateResponse = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/private-lecture-pia-sample`,
    { headers: user1 },
  );
  assert.equal(privateResponse.status, 404);

  const invalidResponse = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/invalid-url-lecture-pia-sample`,
    { headers: user1 },
  );
  assert.equal(invalidResponse.status, 404);
});

test("이어보기 진도는 사용자별로 저장한다", async () => {
  const saved = await post("/api/lectures/progress", user1, {
    lectureId: piaPaidLecture,
    currentPositionSeconds: 120,
    complete: false,
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
  assert.equal(saved.payload.result.currentPositionSeconds, 120);

  const own = await fetch(
    `${baseUrl}/api/lectures/progress?lectureId=${piaPaidLecture}`,
    { headers: user1 },
  ).then((response) => response.json());
  assert.equal(own.result.progress.currentPositionSeconds, 120);

  const other = await fetch(
    `${baseUrl}/api/lectures/progress?lectureId=${piaPaidLecture}`,
    { headers: user2 },
  ).then((response) => response.json());
  assert.notEqual(other.result.progress?.currentPositionSeconds ?? 0, 120);

  const page = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/${piaPaidLecture}`,
    { headers: user1 },
  ).then((response) => response.text());
  assert.match(page, /이어보기 (?:<!-- -->)?2:00/);
});

test("강의 즐겨찾기는 사용자별로 토글한다", async () => {
  const first = await post("/api/lectures/bookmark", user1, {
    lectureId: piaPaidLecture,
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));
  const second = await post("/api/lectures/bookmark", user1, {
    lectureId: piaPaidLecture,
  });
  assert.equal(second.response.status, 200, JSON.stringify(second.payload));
  assert.notEqual(
    first.payload.result.bookmarked,
    second.payload.result.bookmarked,
  );

  const other = await fetch(
    `${baseUrl}/api/lectures/progress?lectureId=${piaPaidLecture}`,
    { headers: user2 },
  ).then((response) => response.json());
  assert.equal(other.result.bookmarked, false);
});

test("강의 메모를 제한하고 HTML을 실행하지 않으며 사용자별로 격리한다", async () => {
  const content = '<img src=x onerror="alert(1)"> 개인 메모';
  const saved = await post("/api/lectures/note", user1, {
    lectureId: piaPaidLecture,
    content,
  });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
  assert.equal(saved.payload.result.content, content);

  const page = await fetch(
    `${baseUrl}/lectures/privacy-impact-assessment/${piaPaidLecture}`,
    { headers: user1 },
  ).then((response) => response.text());
  assert.match(page, /&lt;img src=x onerror=/);
  assert.doesNotMatch(page, /<img src=x onerror=/);

  const other = await fetch(
    `${baseUrl}/api/lectures/progress?lectureId=${piaPaidLecture}`,
    { headers: user2 },
  ).then((response) => response.json());
  assert.equal(other.result.note, "");

  const tooLong = await post("/api/lectures/note", user1, {
    lectureId: piaPaidLecture,
    content: "x".repeat(4001),
  });
  assert.equal(tooLong.response.status, 400);
});
