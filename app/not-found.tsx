import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main">
      <div className="shell section">
        <div className="empty-state">
          <strong>요청한 학습 정보를 찾을 수 없습니다.</strong>
          <p>주소가 올바른지 확인하거나 과정 목록에서 다시 선택해 주세요.</p>
          <Link className="button button-dark" href="/courses">
            과정 목록으로
          </Link>
        </div>
      </div>
    </main>
  );
}
