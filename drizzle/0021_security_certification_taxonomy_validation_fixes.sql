PRAGMA foreign_keys = ON;--> statement-breakpoint

INSERT OR IGNORE INTO question_subjects (question_id, subject_id)
SELECT qc.question_id,
  CASE
    WHEN q.source = 'SECURIUM independently authored application security sample'
      THEN qc.course_id || '-subject-application_security'
    WHEN q.source = 'SECURIUM independently authored management law sample'
      THEN 'course-ise-subject-security_law'
  END
FROM question_courses qc
JOIN questions q ON q.id = qc.question_id
WHERE qc.course_id IN ('course-ise', 'course-isie')
  AND (q.source = 'SECURIUM independently authored application security sample'
    OR (qc.course_id = 'course-ise' AND q.source = 'SECURIUM independently authored management law sample'));--> statement-breakpoint

INSERT OR IGNORE INTO question_topics (question_id, topic_id)
SELECT qs.question_id, qs.subject_id || '-topic-core'
FROM question_subjects qs
JOIN subjects s ON s.id = qs.subject_id
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND NOT EXISTS (
    SELECT 1 FROM question_topics qt
    WHERE qt.question_id = qs.question_id
      AND qt.topic_id = qs.subject_id || '-topic-core'
  );--> statement-breakpoint

UPDATE course_lessons
SET display_title = replace(display_title, '평가 대비', '정보보안일반'),
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND display_title LIKE '%평가 대비%';--> statement-breakpoint

PRAGMA foreign_key_check;
