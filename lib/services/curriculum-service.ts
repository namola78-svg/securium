import { AppError } from "../errors.ts";

export type CurriculumNodeRecord = {
  id: string;
  curriculumTreeId: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  path: string | null;
  status: string;
};

export type CurriculumNodeTree<T extends CurriculumNodeRecord> = T & {
  children: CurriculumNodeTree<T>[];
};

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeMetadata(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  JSON.parse(normalized);
  return normalized;
}

export function assertValidParentSelection(input: {
  nodeId?: string;
  treeId: string;
  parent: CurriculumNodeRecord | null;
  parentId: string | null;
  nodes: CurriculumNodeRecord[];
}) {
  if (!input.parentId) return;
  if (!input.parent) {
    throw new AppError(
      "상위 커리큘럼 노드를 찾을 수 없습니다.",
      400,
      "CURRICULUM_PARENT_NOT_FOUND",
    );
  }
  if (input.parent.curriculumTreeId !== input.treeId) {
    throw new AppError(
      "상위 노드는 같은 커리큘럼 트리에 속해야 합니다.",
      400,
      "CURRICULUM_PARENT_TREE_MISMATCH",
    );
  }
  if (input.parent.status === "ARCHIVED") {
    throw new AppError(
      "보관된 노드는 상위 노드로 사용할 수 없습니다.",
      400,
      "CURRICULUM_PARENT_ARCHIVED",
    );
  }
  if (input.nodeId && input.parentId === input.nodeId) {
    throw new AppError(
      "자기 자신을 상위 노드로 지정할 수 없습니다.",
      400,
      "CURRICULUM_PARENT_SELF",
    );
  }
  if (input.nodeId && isDescendant(input.nodes, input.parentId, input.nodeId)) {
    throw new AppError(
      "하위 노드를 상위 노드로 지정할 수 없습니다.",
      409,
      "CURRICULUM_PARENT_DESCENDANT",
    );
  }
}

export function isDescendant(
  nodes: CurriculumNodeRecord[],
  candidateId: string,
  ancestorId: string,
) {
  let current = nodes.find((node) => node.id === candidateId) ?? null;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id)) {
      throw new AppError(
        "커리큘럼 노드 순환참조가 감지되었습니다.",
        409,
        "CURRICULUM_CYCLE_DETECTED",
      );
    }
    visited.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = current.parentId
      ? nodes.find((node) => node.id === current?.parentId) ?? null
      : null;
  }
  return false;
}

export function assertNoDuplicateSortOrder(input: {
  nodes: CurriculumNodeRecord[];
  treeId: string;
  nodeId?: string;
  parentId: string | null;
  sortOrder: number;
}) {
  const duplicate = input.nodes.find(
    (node) =>
      node.curriculumTreeId === input.treeId &&
      node.id !== input.nodeId &&
      node.parentId === input.parentId &&
      node.status !== "ARCHIVED" &&
      node.sortOrder === input.sortOrder,
  );
  if (duplicate) {
    throw new AppError(
      "같은 상위 노드 아래에서 정렬 순서가 중복됩니다.",
      409,
      "CURRICULUM_SORT_ORDER_DUPLICATE",
    );
  }
}

export function computeNodeDepth(parent: CurriculumNodeRecord | null) {
  return parent ? parent.depth + 1 : 0;
}

export function computeNodePath(parent: CurriculumNodeRecord | null, nodeId: string) {
  return parent?.path ? `${parent.path}/${nodeId}` : `/${nodeId}`;
}

export function buildCurriculumTree<T extends CurriculumNodeRecord>(
  nodes: T[],
): CurriculumNodeTree<T>[] {
  const sorted = [...nodes].sort(compareCurriculumNodes);
  const map = new Map<string, CurriculumNodeTree<T>>();
  for (const node of sorted) {
    map.set(node.id, { ...node, children: [] });
  }
  const roots: CurriculumNodeTree<T>[] = [];
  for (const node of sorted) {
    const current = map.get(node.id);
    if (!current) continue;
    if (node.parentId) {
      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(current);
        continue;
      }
    }
    roots.push(current);
  }
  return roots;
}

export function compareCurriculumNodes(
  left: Pick<CurriculumNodeRecord, "sortOrder" | "id"> & { title?: string },
  right: Pick<CurriculumNodeRecord, "sortOrder" | "id"> & { title?: string },
) {
  return (
    left.sortOrder - right.sortOrder ||
    (left.title ?? "").localeCompare(right.title ?? "") ||
    left.id.localeCompare(right.id)
  );
}

export function recalculateSubtreePaths(input: {
  nodes: CurriculumNodeRecord[];
  rootId: string;
  rootDepth: number;
  rootPath: string;
}) {
  const childrenByParent = new Map<string, CurriculumNodeRecord[]>();
  for (const node of input.nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const updates: Array<{ id: string; depth: number; path: string }> = [];
  const visit = (parentId: string, parentDepth: number, parentPath: string) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      const depth = parentDepth + 1;
      const path = `${parentPath}/${child.id}`;
      updates.push({ id: child.id, depth, path });
      visit(child.id, depth, path);
    }
  };
  visit(input.rootId, input.rootDepth, input.rootPath);
  return updates;
}
