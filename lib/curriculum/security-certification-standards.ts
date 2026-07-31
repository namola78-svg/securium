export type SecurityCertificationCourseCode = "ISE" | "ISIE";
export type SecurityCertificationExamType = "WRITTEN" | "PRACTICAL";
export type OfficialCurriculumNodeType =
  | "TRACK"
  | "SUBJECT"
  | "PRACTICAL"
  | "MAJOR_ITEM"
  | "SUB_ITEM"
  | "STANDARD";

export type OfficialCurriculumNodeDefinition = {
  title: string;
  nodeType: OfficialCurriculumNodeType;
  officialLevel:
    | "EXAM_TRACK"
    | "SUBJECT"
    | "PRACTICAL_DOMAIN"
    | "MAJOR_ITEM"
    | "SUB_ITEM"
    | "DETAIL_ITEM"
    | "PERFORMANCE_CRITERION";
  isRequired?: boolean;
  isPractical?: boolean;
  importance?: number;
  notes?: string;
  children?: OfficialCurriculumNodeDefinition[];
};

export type OfficialCurriculumTreeDefinition = {
  treeId: string;
  courseId: string;
  courseCode: SecurityCertificationCourseCode;
  version: "2027-2029";
  title: string;
  sourceType: "OFFICIAL_EXAM_STANDARD";
  sourceDocument: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: "DRAFT";
  nodes: OfficialCurriculumNodeDefinition[];
};

export type FlattenedOfficialCurriculumNode = {
  stableKey: string;
  title: string;
  nodeType: OfficialCurriculumNodeType;
  officialLevel: OfficialCurriculumNodeDefinition["officialLevel"];
  parentStableKey: string | null;
  sortOrder: number;
  depth: number;
  path: string;
  isRequired: boolean;
  isPractical: boolean;
  importance: number | null;
  notes: string | null;
  metadata: {
    source: "USER_PROVIDED_OFFICIAL_STANDARD_IMAGE";
    courseCode: SecurityCertificationCourseCode;
    version: "2027-2029";
    officialLevel: OfficialCurriculumNodeDefinition["officialLevel"];
    confirmedFromImage: true;
    needsPdfVerification: true;
  };
};

const systemSecurityWritten: OfficialCurriculumNodeDefinition = {
  title: "시스템보안",
  nodeType: "SUBJECT",
  officialLevel: "SUBJECT",
  children: [
    {
      title: "정보 시스템의 범위 및 이해",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "단말 및 서버 시스템", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "운영체제", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "시스템 정보", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "시스템 보안위협 및 공격기법",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "시스템 보안위협", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "시스템 공격기법", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "시스템 보안위협 및 공격에 대한 예방과 대응",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "시스템보안 대응기술", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "시스템 분석 도구", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "시스템 보안 솔루션", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
  ],
};

const networkSecurityWritten: OfficialCurriculumNodeDefinition = {
  title: "네트워크보안",
  nodeType: "SUBJECT",
  officialLevel: "SUBJECT",
  children: [
    {
      title: "네트워크 일반",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "네트워크 개념 이해", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "네트워크의 활용", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "네트워크 기반 공격기술의 이해 및 대응",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "서비스 거부 및 분산 서비스 거부 공격", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "스캐닝", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "스푸핑 공격", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "스니핑 공격", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "원격접속 공격", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "네트워크 보안 기술",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "보안 프로토콜 이해", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "네트워크 보안기술 이해", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
  ],
};

const applicationSecurityWritten: OfficialCurriculumNodeDefinition = {
  title: "어플리케이션보안",
  nodeType: "SUBJECT",
  officialLevel: "SUBJECT",
  children: [
    {
      title: "인터넷 응용 보안",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "FTP 보안", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "메일 보안", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "Web/App 보안", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "DNS 보안", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "DB 보안", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "어플리케이션 보안 취약점",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "어플리케이션 보안취약 유형과 대응", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "어플리케이션 개발 보안 개요", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
  ],
};

const informationSecurityGeneralWritten: OfficialCurriculumNodeDefinition = {
  title: "정보보안일반",
  nodeType: "SUBJECT",
  officialLevel: "SUBJECT",
  children: [
    {
      title: "보안요소 기술",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "인증", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "접근통제", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "키 분배 프로토콜", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "디지털서명", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "암호학",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "암호 알고리즘", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "해시함수", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "최신 보안 동향",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "보안 동향 일반", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
  ],
};

const securityManagementLawWritten: OfficialCurriculumNodeDefinition = {
  title: "정보보안관리 및 법규",
  nodeType: "SUBJECT",
  officialLevel: "SUBJECT",
  children: [
    {
      title: "정보보호 관리",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "정보보호 관리 이해", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "정보보호 위험평가", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "정보보호 대책 구현 및 사고대응", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "정보보호 인증제도 이해", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
    {
      title: "정보보호 관련 윤리 및 법규",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      children: [
        { title: "정보보안 윤리", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "정보보호 관련 법제", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
        { title: "개인정보보호 관련 법제", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM" },
      ],
    },
  ],
};

export const SECURITY_CERTIFICATION_SHARED_WRITTEN_SUBJECTS = [
  systemSecurityWritten,
  networkSecurityWritten,
  applicationSecurityWritten,
  informationSecurityGeneralWritten,
];

export const SECURITY_CERTIFICATION_ENGINEER_ONLY_WRITTEN_SUBJECTS = [
  securityManagementLawWritten,
];

const sharedPracticalBeforeEngineerOnly: OfficialCurriculumNodeDefinition[] = [
    {
      title: "시스템 및 네트워크 보안특성 파악",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      isPractical: true,
      children: [
        { title: "운영체제 및 가상화 환경 보안특성 파악하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "프로토콜별 보안특성 파악하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "서비스별 보안특성 파악하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "보안장비 및 네트워크 장비별 보안특성 파악하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
      ],
    },
    {
      title: "취약점 점검 및 보완",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      isPractical: true,
      children: [
        { title: "운영체제 보안설정 점검과 보완하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "서비스 보안설정 점검과 보완하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "네트워크 및 보안장비 설정 점검과 보완하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "취약점 점검이력과 보안내용 관리하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
      ],
    },
    {
      title: "보안 로그 수집·분석 및 침해 대응",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      isPractical: true,
      children: [
        { title: "보안목표 수립 및 침해 탐지·대응", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "보안 로그분석 및 침해탐지·대응", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
      ],
    },
];

export const SECURITY_CERTIFICATION_ENGINEER_ONLY_PRACTICAL_ITEMS: OfficialCurriculumNodeDefinition[] = [
    {
      title: "위험분석 및 정보보호 대책 수립",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      isPractical: true,
      children: [
        { title: "IT 자산 위험 분석하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "조직의 정보자산 위험 및 취약점 분석·정리하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "위험평가하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
        { title: "정보보호대책 선정 및 이행계획 수립하기", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
      ],
    },
];

const sharedPracticalAfterEngineerOnly: OfficialCurriculumNodeDefinition[] = [
    {
      title: "최신 보안 동향",
      nodeType: "MAJOR_ITEM",
      officialLevel: "MAJOR_ITEM",
      isPractical: true,
      children: [
        { title: "보안 동향 일반", nodeType: "SUB_ITEM", officialLevel: "SUB_ITEM", isPractical: true },
      ],
    },
];

export const SECURITY_CERTIFICATION_SHARED_PRACTICAL_ITEMS: OfficialCurriculumNodeDefinition[] = [
  ...sharedPracticalBeforeEngineerOnly,
  ...sharedPracticalAfterEngineerOnly,
];

const engineerPractical: OfficialCurriculumNodeDefinition = {
  title: "정보보안 실무",
  nodeType: "PRACTICAL",
  officialLevel: "PRACTICAL_DOMAIN",
  isPractical: true,
  children: [
    ...sharedPracticalBeforeEngineerOnly,
    ...SECURITY_CERTIFICATION_ENGINEER_ONLY_PRACTICAL_ITEMS,
    ...sharedPracticalAfterEngineerOnly,
  ],
};

const industrialPractical: OfficialCurriculumNodeDefinition = {
  title: "정보보안 실무",
  nodeType: "PRACTICAL",
  officialLevel: "PRACTICAL_DOMAIN",
  isPractical: true,
  children: SECURITY_CERTIFICATION_SHARED_PRACTICAL_ITEMS,
};

export const SECURITY_CERTIFICATION_CURRICULUM_TREES: OfficialCurriculumTreeDefinition[] = [
  {
    treeId: "curriculum-ise-2027-2029-official",
    courseId: "course-ise",
    courseCode: "ISE",
    version: "2027-2029",
    title: "정보보안기사 2027~2029 공식 출제기준",
    sourceType: "OFFICIAL_EXAM_STANDARD",
    sourceDocument: "정보보안기사 필기·실기 출제기준",
    effectiveFrom: "2027-01-01",
    effectiveTo: "2029-12-31",
    status: "DRAFT",
    nodes: [
      {
        title: "필기",
        nodeType: "TRACK",
        officialLevel: "EXAM_TRACK",
        children: [
          ...SECURITY_CERTIFICATION_SHARED_WRITTEN_SUBJECTS,
          ...SECURITY_CERTIFICATION_ENGINEER_ONLY_WRITTEN_SUBJECTS,
        ],
      },
      {
        title: "실기",
        nodeType: "TRACK",
        officialLevel: "EXAM_TRACK",
        isPractical: true,
        children: [engineerPractical],
      },
    ],
  },
  {
    treeId: "curriculum-isie-2027-2029-official",
    courseId: "course-isie",
    courseCode: "ISIE",
    version: "2027-2029",
    title: "정보보안산업기사 2027~2029 공식 출제기준",
    sourceType: "OFFICIAL_EXAM_STANDARD",
    sourceDocument: "정보보안산업기사 필기·실기 출제기준",
    effectiveFrom: "2027-01-01",
    effectiveTo: "2029-12-31",
    status: "DRAFT",
    nodes: [
      {
        title: "필기",
        nodeType: "TRACK",
        officialLevel: "EXAM_TRACK",
        children: SECURITY_CERTIFICATION_SHARED_WRITTEN_SUBJECTS,
      },
      {
        title: "실기",
        nodeType: "TRACK",
        officialLevel: "EXAM_TRACK",
        isPractical: true,
        children: [industrialPractical],
      },
    ],
  },
];

export function flattenOfficialCurriculumTree(
  tree: OfficialCurriculumTreeDefinition,
): FlattenedOfficialCurriculumNode[] {
  const nodes: FlattenedOfficialCurriculumNode[] = [];

  function visit(
    definition: OfficialCurriculumNodeDefinition,
    parentStableKey: string | null,
    parentPath: string,
    depth: number,
    indexes: number[],
  ) {
    const suffix = indexes.map((index) => String(index).padStart(2, "0")).join("-");
    const stableKey = `${tree.courseCode}-${tree.version}-${suffix}`;
    const path = `${parentPath}/${stableKey}`;
    nodes.push({
      stableKey,
      title: definition.title,
      nodeType: definition.nodeType,
      officialLevel: definition.officialLevel,
      parentStableKey,
      sortOrder: indexes[indexes.length - 1] * 10,
      depth,
      path,
      isRequired: definition.isRequired ?? true,
      isPractical: definition.isPractical ?? false,
      importance: definition.importance ?? null,
      notes: definition.notes ?? null,
      metadata: {
        source: "USER_PROVIDED_OFFICIAL_STANDARD_IMAGE",
        courseCode: tree.courseCode,
        version: tree.version,
        officialLevel: definition.officialLevel,
        confirmedFromImage: true,
        needsPdfVerification: true,
      },
    });

    definition.children?.forEach((child, childIndex) => {
      visit(child, stableKey, path, depth + 1, [...indexes, childIndex + 1]);
    });
  }

  tree.nodes.forEach((node, index) => visit(node, null, "", 0, [index + 1]));
  return nodes;
}

export function getOfficialCurriculumTree(
  treeId: string,
): OfficialCurriculumTreeDefinition | null {
  return (
    SECURITY_CERTIFICATION_CURRICULUM_TREES.find((tree) => tree.treeId === treeId) ??
    null
  );
}
