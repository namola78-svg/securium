import { EmptyState } from "@/components/state-ui";

export default function NotFound() {
  return (
    <main className="page-main">
      <div className="shell section">
        <EmptyState
          title="요청한 학습 정보를 찾을 수 없습니다"
          description="주소를 확인하거나 과정 목록에서 다른 학습 경로를 선택해주세요."
          action={{ href: "/courses", label: "과정 둘러보기" }}
          secondaryAction={{ href: "/", label: "홈으로 이동" }}
        />
      </div>
    </main>
  );
}
