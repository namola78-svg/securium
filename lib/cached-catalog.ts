import { unstable_cache } from "next/cache";
import {
  getPublicCourseBySlug,
  listCurriculum,
  listPublishedCourses,
} from "@/db/repositories";
import {
  filterCanonicalCppgVisibility,
  hasCanonicalLearnerVisibility,
  shouldBypassCppgCurriculumCache,
} from "@/lib/services/cppg-learner-visibility.ts";

const cacheOptions = {
  revalidate: 60,
  tags: ["public-catalog"],
};

async function cachedListCurriculum(courseId: string) {
  return listCurriculum(courseId);
}

async function cachedListPublishedCourses() {
  return listPublishedCourses();
}

async function cachedGetPublicCourseBySlug(slug: string) {
  return getPublicCourseBySlug(slug);
}

const cachedPublishedCourses = process.env.NODE_ENV === "test"
  ? cachedListPublishedCourses
  : unstable_cache(cachedListPublishedCourses, ["list-published-courses"], cacheOptions);
const cachedPublicCourseBySlug = process.env.NODE_ENV === "test"
  ? cachedGetPublicCourseBySlug
  : unstable_cache(cachedGetPublicCourseBySlug, ["get-public-course-by-slug"], cacheOptions);
const cachedCurriculumByCourse = process.env.NODE_ENV === "test"
  ? cachedListCurriculum
  : unstable_cache(cachedListCurriculum, ["list-curriculum"], cacheOptions);

export async function listPublishedCoursesCached() {
  // Recheck CPPG proof after cache lookup so stale cached rows cannot grant visibility.
  return filterCanonicalCppgVisibility(await cachedPublishedCourses());
}

export async function getPublicCourseBySlugCached(slug: string) {
  const course = await cachedPublicCourseBySlug(slug);
  return course && await hasCanonicalLearnerVisibility(course) ? course : null;
}

export const listCurriculumCached =
  process.env.NODE_ENV === "test"
    ? listCurriculum
    : async (courseId: string) => shouldBypassCppgCurriculumCache(courseId)
      ? listCurriculum(courseId)
      : cachedCurriculumByCourse(courseId);
