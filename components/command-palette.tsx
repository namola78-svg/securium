"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type CommandScope = "공개" | "학습" | "관리자" | "운영";

type CommandItem = {
  title: string;
  description: string;
  href: string;
  keywords: string[];
  scope: CommandScope;
};

const learnerCommands: CommandItem[] = [
  {
    title: "과정 둘러보기",
    description: "공개된 SECURIUM 과정을 비교하고 상세 정보를 확인합니다.",
    href: "/courses",
    keywords: ["course", "catalog", "과정", "강좌"],
    scope: "공개",
  },
  {
    title: "학습 가이드",
    description: "과정 선택, 진도 관리, 문제풀이 시작 방법을 확인합니다.",
    href: "/guide",
    keywords: ["guide", "help", "학습", "가이드"],
    scope: "공개",
  },
  {
    title: "학습 시작",
    description: "오늘의 학습, 복습, 진행 중인 과정을 확인합니다.",
    href: "/dashboard",
    keywords: ["dashboard", "home", "대시보드", "오늘", "시작"],
    scope: "학습",
  },
  {
    title: "이론 학습",
    description: "수강 중인 과정과 과정별 이론 학습 상태를 확인합니다.",
    href: "/my-courses",
    keywords: ["my courses", "enrollment", "내 과정", "수강", "이론"],
    scope: "학습",
  },
  {
    title: "문제 풀이",
    description: "과정별 문제를 풀고 채점 결과를 확인합니다.",
    href: "/practice",
    keywords: ["practice", "question", "문제", "풀이"],
    scope: "학습",
  },
  {
    title: "오답노트",
    description: "틀린 문제와 반복 오답을 과정별로 복습합니다.",
    href: "/wrong-notes",
    keywords: ["wrong", "note", "오답", "복습"],
    scope: "학습",
  },
  {
    title: "복습",
    description: "스마트 복습 대상과 연체된 복습을 확인합니다.",
    href: "/reviews",
    keywords: ["review", "today", "복습", "스마트"],
    scope: "학습",
  },
  {
    title: "AI 튜터",
    description: "근거 기반 AI 설명과 학습 힌트를 확인합니다.",
    href: "/ai-tutor",
    keywords: ["ai", "tutor", "튜터", "설명"],
    scope: "학습",
  },
];

const operatorCommands: CommandItem[] = [
  {
    title: "관리자 운영 대시보드",
    description: "과정, 커리큘럼, 콘텐츠, 온톨로지 운영 상태를 봅니다.",
    href: "/admin",
    keywords: ["admin", "console", "관리자", "운영"],
    scope: "관리자",
  },
  {
    title: "커리큘럼 관리",
    description: "공식 출제기준 트리와 학습 콘텐츠 연결 상태를 점검합니다.",
    href: "/admin/curriculum",
    keywords: ["curriculum", "tree", "coverage", "커리큘럼"],
    scope: "관리자",
  },
  {
    title: "지식 연결 관리",
    description: "개념, 별칭, 관계, 과정 간 연결을 검색합니다.",
    href: "/admin/ontology",
    keywords: ["ontology", "concept", "alias", "온톨로지"],
    scope: "관리자",
  },
  {
    title: "AI 근거 추적",
    description: "AI 응답의 검색 근거, 인용, 프롬프트, 비용 정보를 추적합니다.",
    href: "/admin/ai-explainability",
    keywords: ["ai trace", "retrieval", "prompt", "citation"],
    scope: "관리자",
  },
  {
    title: "운영 상태",
    description: "운영 환경, 보안 헤더, 헬스체크 상태를 점검합니다.",
    href: "/ops/health",
    keywords: ["ops", "health", "운영", "상태"],
    scope: "운영",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const commands = useMemo(
    () =>
      pathname.startsWith("/admin") || pathname.startsWith("/ops")
        ? [...learnerCommands, ...operatorCommands]
        : learnerCommands,
    [pathname],
  );

  const filteredCommands = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return commands;
    return commands.filter((command) => {
      const haystack = normalize(
        [
          command.title,
          command.description,
          command.scope,
          command.href,
          ...command.keywords,
        ].join(" "),
      );
      return haystack.includes(normalizedQuery);
    });
  }, [commands, query]);

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function closePalette() {
    setOpen(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
        return;
      }

      if (typing && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) =>
          filteredCommands.length ? (index + 1) % filteredCommands.length : 0,
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) =>
          filteredCommands.length
            ? (index - 1 + filteredCommands.length) % filteredCommands.length
            : 0,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredCommands.length, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!dialogRef.current?.contains(event.target as Node)) {
        closePalette();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    const timer = window.setTimeout(() => closePalette(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  function runCommand(command: CommandItem) {
    closePalette();
    router.push(command.href);
  }

  const activeCommand = filteredCommands[activeIndex];

  return (
    <>
      <button
        className="command-palette-trigger"
        type="button"
        aria-label="명령 팔레트 열기"
        onClick={openPalette}
      >
        <span>빠른 이동</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open ? (
        <div className="command-palette-backdrop" role="presentation">
          <div
            className="command-palette-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
          >
            <div className="command-palette-header">
              <div>
                <p className="eyebrow">COMMAND PALETTE</p>
                <h2 id="command-palette-title">SECURIUM 빠른 이동</h2>
              </div>
              <button
                type="button"
                aria-label="명령 팔레트 닫기"
                onClick={closePalette}
              >
                ×
              </button>
            </div>

            <input
              ref={inputRef}
              type="search"
              value={query}
              aria-label="명령 검색"
              aria-controls="command-palette-list"
              aria-activedescendant={
                activeCommand ? commandId(activeCommand) : undefined
              }
              placeholder="이동할 화면이나 작업을 검색하세요"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && activeCommand) {
                  event.preventDefault();
                  runCommand(activeCommand);
                }
              }}
            />

            <div
              className="command-palette-list"
              id="command-palette-list"
              role="listbox"
              aria-label="명령 결과"
            >
              {filteredCommands.length ? (
                filteredCommands.map((command, index) => (
                  <button
                    className={index === activeIndex ? "active" : undefined}
                    id={commandId(command)}
                    key={command.href}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                  >
                    <span>
                      <strong>{command.title}</strong>
                      <small>{command.description}</small>
                    </span>
                    <mark>{command.scope}</mark>
                  </button>
                ))
              ) : (
                <div className="command-palette-empty" role="status">
                  <strong>검색 결과가 없습니다</strong>
                  <p>다른 화면명, 기능명, 또는 키워드로 검색해보세요.</p>
                </div>
              )}
            </div>

            <div className="command-palette-footer">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> 이동
              </span>
              <span>
                <kbd>Enter</kbd> 열기
              </span>
              <span>
                <kbd>Esc</kbd> 닫기
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function commandId(command: CommandItem) {
  return `command-${command.href.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}
