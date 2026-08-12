"use client";
import { Phase11RouteError } from "@/components/v2/phase11-route-state";
export default function Error({ reset }: { reset: () => void }) { return <Phase11RouteError reset={reset} title="마이페이지를 불러오지 못했습니다." />; }
