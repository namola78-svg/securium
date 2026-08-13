import type { ReactNode } from "react";
import { publicCopy } from "@/lib/public-copy";
import { parseStructuredLessonContent } from "@/lib/services/structured-content-service";

function safeReferenceUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function inlineContent(text: string, keyPrefix: string): ReactNode[] {
  const pattern =
    /(!?\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("![")) {
      const parts = /^!\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = parts ? safeReferenceUrl(parts[2]) : null;
      nodes.push(
        href ? (
          <a className="lesson-attachment" href={href} key={key} rel="noreferrer">`r`n            이미지 참고 · {parts?.[1]}`r`n          </a>
        ) : (
          <span className="lesson-invalid-reference" key={key}>`r`n            이미지 참조를 표시할 수 없습니다.`r`n          </span>
        ),
      );
    } else if (token.startsWith("[")) {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = parts ? safeReferenceUrl(parts[2]) : null;
      nodes.push(
        href ? (
          <a href={href} key={key} rel="noreferrer">
            {parts?.[1]}
          </a>
        ) : (
          <span className="lesson-invalid-reference" key={key}>`r`n            이미지 참조를 표시할 수 없습니다.`r`n          </span>
        ),
      );
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function SafeLessonContent({
  content,
  format,
}: {
  content: string;
  format: string;
}) {
  if (format === "STRUCTURED_JSON") {
    const structured = parseStructuredLessonContent(content);
    if (!structured) {
      return (
        <div className="lesson-prose" role="status">
          <p>학습 본문을 표시할 수 없습니다.</p>
        </div>
      );
    }
    return (
      <div className="lesson-prose" data-structured-content-v3="">
        {structured.sections.map((section) => (
          <section key={section.key} data-content-section={section.key}>
            <h2>{section.label}</h2>
            {section.items.length === 1 ? (
              <p>{publicCopy(section.items[0])}</p>
            ) : (
              <ul>
                {section.items.map((item, index) => (
                  <li key={`${section.key}-${index}`}>{publicCopy(item)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    );
  }

  const safeContent = publicCopy(content);

  if (format === "PLAIN_TEXT") {
    return (
      <div className="lesson-prose">
        {safeContent.split(/\r?\n\r?\n/).map((paragraph, index) => (
          <p key={`plain-${index}`}>{paragraph}</p>
        ))}
      </div>
    );
  }

  const lines = safeContent.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="lesson-code" key={`code-${index}`}>
          <code data-language={language || undefined}>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const children = inlineContent(heading[2], `heading-${index}`);
      if (level === 1) blocks.push(<h2 key={`h-${index}`}>{children}</h2>);
      if (level === 2) blocks.push(<h3 key={`h-${index}`}>{children}</h3>);
      if (level === 3) blocks.push(<h4 key={`h-${index}`}>{children}</h4>);
      if (level === 4) blocks.push(<h5 key={`h-${index}`}>{children}</h5>);
      index += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote-${index}`}>
          {inlineContent(quote.join(" "), `quote-${index}`)}
        </blockquote>,
      );
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>
              {inlineContent(item, `ul-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>
              {inlineContent(item, `ol-${index}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="lesson-table-wrap" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={`th-${cellIndex}`} scope="col">
                    {inlineContent(cell, `th-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`tr-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`td-${rowIndex}-${cellIndex}`}>
                      {inlineContent(cell, `td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !lines[index].startsWith("```") &&
      !lines[index].startsWith("> ") &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`}>
        {inlineContent(paragraph.join(" "), `p-${index}`)}
      </p>,
    );
  }
  return <div className="lesson-prose">{blocks}</div>;
}
