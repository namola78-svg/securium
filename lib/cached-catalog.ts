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

export const listPublishedCoursesCached =
  process.env.NODE_ENV === "test"
    ? listPublishedCourses
    : unstable_cache(
        listPublishedCourses,
        ["list-published-courses"],
        cacheOptions,
      );

export const getPublicCourseBySlugCached =
  process.env.NODE_ENV === "test"
    ? getPublicCourseBySlug
    : unstable_cache(
        getPublicCourseBySlug,
        ["get-public-course-by-slug"],
        cacheOptions,
      );

export const listCurriculumCached =
  process.env.NODE_ENV === "test"
    ? listCurriculum
    : unstable_cache(listCurriculum, ["list-curriculum"], cacheOptions);
