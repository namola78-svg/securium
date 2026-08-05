"use client";

import dynamic from "next/dynamic";

import type { ComponentProps } from "react";
import type { AdminCurriculumManager as AdminCurriculumManagerComponent } from "@/components/admin-curriculum-manager";

import { CardSkeleton } from "@/components/state-ui";
type AdminCurriculumManagerProps = ComponentProps<
  typeof AdminCurriculumManagerComponent
>;

const AdminCurriculumManagerNoSsr = dynamic(
  () =>
    import("@/components/admin-curriculum-manager").then(
      (module) => module.AdminCurriculumManager,
    ),
  {
    ssr: false,
    loading: () => (
      <section
        className="admin-panel"
        role="status"
        aria-live="polite"
        aria-label="커리큘럼 관리자 화면을 불러오고 있습니다"
      >
        <CardSkeleton />
      </section>
    ),
  },
);

export function AdminCurriculumManager(
  props: AdminCurriculumManagerProps,
) {
  return <AdminCurriculumManagerNoSsr {...props} />;
}
