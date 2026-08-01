export type SourcePageMetadata = {
  sourcePage?: number | string;
  sourcePages?: Array<number | string>;
  pdfPage?: number | string;
  pageNumber?: number | string;
  pageNumbers?: Array<number | string>;
  needsPdfVerification?: boolean;
};

export function sourcePageLabel(metadata: SourcePageMetadata) {
  const pages = [
    ...(metadata.sourcePages ?? []),
    ...(metadata.pageNumbers ?? []),
    metadata.sourcePage,
    metadata.pdfPage,
    metadata.pageNumber,
  ].filter(isPresentPage);

  if (pages.length) {
    return `PDF ${pages.join(", ")}쪽`;
  }

  return metadata.needsPdfVerification ? "PDF 페이지 확인 필요" : "PDF 페이지 미지정";
}

export function curriculumStatusLabel(status: string) {
  if (status === "DRAFT") return "초안";
  if (status === "ACTIVE") return "활성";
  if (status === "INACTIVE") return "비활성";
  if (status === "ARCHIVED") return "보관";
  return status;
}

function isPresentPage(value: number | string | null | undefined): value is number | string {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}
