import { unstable_cache } from "next/cache";
import {
  getPublicCourseBySlug,
  listCurriculum,
  listPublishedCourses,
} from "@/db/repositories";

const cacheOptions = {
  revalidate: 60,
  tags: ["public-catalog"],
};

async function cachedListPublishedCourses() {
  return listPublishedCourses();
}

async function cachedGetPublicCourseBySlug(slug: string) {
  return getPublicCourseBySlug(slug);
}

async function cachedListCurriculum(courseId: string) {
  return listCurriculum(courseId);
}

export const listPublishedCoursesCached =
  process.env.NODE_ENV === "test"
    ? listPublishedCourses
    : unstable_cache(
        cachedListPublishedCourses,
        ["list-published-courses"],
        cacheOptions,
      );

export const getPublicCourseBySlugCached =
  process.env.NODE_ENV === "test"
    ? getPublicCourseBySlug
    : unstable_cache(
        cachedGetPublicCourseBySlug,
        ["get-public-course-by-slug"],
        cacheOptions,
      );

export const listCurriculumCached =
  process.env.NODE_ENV === "test"
    ? listCurriculum
    : unstable_cache(cachedListCurriculum, ["list-curriculum"], cacheOptions);
