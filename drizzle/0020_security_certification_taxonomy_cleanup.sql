PRAGMA foreign_keys = ON;--> statement-breakpoint

UPDATE courses
SET description = CASE id
    WHEN 'course-ise' THEN '정보보안기사 필기·실기 공식 출제기준 기반 학습 과정'
    WHEN 'course-isie' THEN '정보보안산업기사 필기·실기 공식 출제기준 기반 학습 과정'
  END,
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE id IN ('course-ise', 'course-isie');--> statement-breakpoint

UPDATE subjects
SET name = CASE code
    WHEN 'SYSTEM_SECURITY' THEN '시스템보안'
    WHEN 'NETWORK_SECURITY' THEN '네트워크보안'
    WHEN 'APPLICATION_SECURITY' THEN '애플리케이션보안'
    WHEN 'SECURITY_FOUNDATION' THEN '정보보안일반'
    WHEN 'SECURITY_LAW' THEN '정보보안관리 및 법규'
  END,
  description = CASE code
    WHEN 'SYSTEM_SECURITY' THEN '운영체제·서버·클라이언트 환경의 위협과 보안 통제를 학습합니다.'
    WHEN 'NETWORK_SECURITY' THEN '네트워크 원리, 공격기술과 보안기술을 학습합니다.'
    WHEN 'APPLICATION_SECURITY' THEN '웹·애플리케이션 위협과 안전한 구현·운영 방법을 학습합니다.'
    WHEN 'SECURITY_FOUNDATION' THEN '암호, 인증, 접근통제와 정보보호 일반 원리를 학습합니다.'
    WHEN 'SECURITY_LAW' THEN '정보보호 관리체계, 위험관리와 관련 법규를 학습합니다.'
  END,
  display_order = CASE code
    WHEN 'SYSTEM_SECURITY' THEN 1
    WHEN 'NETWORK_SECURITY' THEN 2
    WHEN 'APPLICATION_SECURITY' THEN 3
    WHEN 'SECURITY_FOUNDATION' THEN 4
    WHEN 'SECURITY_LAW' THEN 5
  END,
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW');--> statement-breakpoint

UPDATE topics
SET name = (SELECT s.name || ' 핵심 주제' FROM subjects s WHERE s.id = topics.subject_id),
  description = '공식 출제기준의 주요 항목과 연결되는 과목별 학습 주제입니다.',
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE subject_id IN (
  SELECT id FROM subjects
  WHERE course_id IN ('course-ise', 'course-isie')
    AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
    AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
);--> statement-breakpoint

UPDATE learning_units
SET title = (SELECT t.name || ' 학습단위' FROM topics t WHERE t.id = learning_units.topic_id),
  description = '과목별 이론과 문제 학습을 연결하는 학습단위입니다.',
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
      AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
  );--> statement-breakpoint

UPDATE lessons
SET title = (SELECT s.name || ' 핵심 이론' FROM subjects s WHERE s.id = lessons.subject_id),
  summary = (SELECT s.name || '의 핵심 개념과 시험 적용 관점을 정리합니다.' FROM subjects s WHERE s.id = lessons.subject_id),
  content = replace(replace(replace(content, '[개발용 샘플 본문]', ''), '[개발용 샘플]', ''), '개발용 콘텐츠', '학습 콘텐츠'),
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
      AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
  );--> statement-breakpoint

INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
SELECT id, 'course-ise', 100
FROM questions
WHERE source = 'SECURIUM_CONTENT_UPGRADE_V2'
  AND id LIKE 'sec-upgrade-practical-%';--> statement-breakpoint

DELETE FROM question_courses
WHERE course_id = 'course-isie'
  AND question_id IN (
    SELECT id FROM questions
    WHERE source = 'SECURIUM_CONTENT_UPGRADE_V2'
      AND id LIKE 'sec-upgrade-practical-%'
  );--> statement-breakpoint

INSERT OR IGNORE INTO question_subjects (question_id, subject_id)
SELECT DISTINCT qs.question_id,
  CASE
    WHEN q.source = 'SECURIUM_CONTENT_UPGRADE_V2' AND q.id LIKE 'sec-upgrade-practical-%' THEN
      CASE
        WHEN q.title LIKE '%SQL injection%' OR q.title LIKE '%Web and API%' THEN 'course-ise-subject-application_security'
        WHEN q.title LIKE '%ARP spoofing%' OR q.title LIKE '%Email authentication%' OR q.title LIKE '%IDS and IPS%' THEN 'course-ise-subject-network_security'
        WHEN q.title LIKE '%Linux security%' OR q.title LIKE '%Windows security%' OR q.title LIKE '%Forensics%' THEN 'course-ise-subject-system_security'
        WHEN q.title LIKE '%Risk management%' OR q.title LIKE '%BCP and disaster recovery%' THEN 'course-ise-subject-security_law'
        ELSE 'course-ise-subject-security_foundation'
      END
    WHEN s.code = 'SECURITY_LAW' AND s.course_id = 'course-isie' THEN 'course-isie-subject-security_foundation'
    WHEN q.source LIKE '%network security%' OR q.source LIKE '%ARP spoofing%' THEN s.course_id || '-subject-network_security'
    WHEN q.source LIKE '%system security%' OR q.source LIKE '%Linux file permission%' THEN s.course_id || '-subject-system_security'
    ELSE s.course_id || '-subject-security_foundation'
  END
FROM question_subjects qs
JOIN subjects s ON s.id = qs.subject_id
JOIN questions q ON q.id = qs.question_id
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND (s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
    OR (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW'));--> statement-breakpoint

INSERT OR IGNORE INTO question_topics (question_id, topic_id)
SELECT qs.question_id, s.id || '-topic-core'
FROM question_subjects qs
JOIN subjects s ON s.id = qs.subject_id
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND s.code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW');--> statement-breakpoint

DELETE FROM question_topics
WHERE topic_id IN (
  SELECT t.id FROM topics t JOIN subjects s ON s.id = t.subject_id
  WHERE s.course_id IN ('course-ise', 'course-isie')
    AND (s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
      OR (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW'))
);--> statement-breakpoint

DELETE FROM question_subjects
WHERE subject_id IN (
  SELECT id FROM subjects
  WHERE course_id IN ('course-ise', 'course-isie')
    AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
      OR (course_id = 'course-isie' AND code = 'SECURITY_LAW'))
);--> statement-breakpoint

UPDATE user_progress
SET subject_id = course_id || '-subject-security_foundation',
  topic_id = course_id || '-subject-security_foundation-topic-core',
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
  );--> statement-breakpoint

UPDATE bookmarks
SET target_id = CASE target_type
    WHEN 'SUBJECT' THEN course_id || '-subject-security_foundation'
    WHEN 'TOPIC' THEN course_id || '-subject-security_foundation-topic-core'
    ELSE target_id
  END
WHERE course_id IN ('course-ise', 'course-isie')
  AND ((target_type = 'SUBJECT' AND target_id IN (
      SELECT id FROM subjects WHERE course_id IN ('course-ise', 'course-isie') AND code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
    )) OR (target_type = 'TOPIC' AND target_id IN (
      SELECT t.id FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id IN ('course-ise', 'course-isie') AND s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
    )));--> statement-breakpoint

UPDATE review_schedules
SET target_id = course_id || '-subject-security_foundation-topic-core',
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND target_type = 'TOPIC'
  AND target_id IN (
    SELECT t.id FROM topics t JOIN subjects s ON s.id=t.subject_id
    WHERE s.course_id IN ('course-ise', 'course-isie') AND s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
  );--> statement-breakpoint

UPDATE mock_exam_sections
SET subject_id = CASE
    WHEN subject_id LIKE 'course-ise-%' THEN 'course-ise-subject-security_foundation'
    ELSE 'course-isie-subject-security_foundation'
  END
WHERE subject_id IN (
  SELECT id FROM subjects
  WHERE course_id IN ('course-ise', 'course-isie')
    AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
);--> statement-breakpoint

UPDATE lectures
SET subject_id = course_id || '-subject-security_foundation',
  topic_id = course_id || '-subject-security_foundation-topic-core',
  title = replace(replace(replace(replace(title, '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'), '평가 대비', '정보보안일반'), '정보보안 관리 및 법규', '정보보안일반'),
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects WHERE course_id IN ('course-ise', 'course-isie')
      AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
  );--> statement-breakpoint

UPDATE audio_contents
SET lesson_id = CASE
    WHEN lesson_id LIKE 'course-ise-%' THEN 'course-ise-subject-security_foundation-topic-core-lesson-01'
    ELSE 'course-isie-subject-security_foundation-topic-core-lesson-01'
  END,
  title = replace(replace(replace(replace(title, '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'), '평가 대비', '정보보안일반'), '정보보안 관리 및 법규', '정보보안일반'),
  updated_at = CURRENT_TIMESTAMP
WHERE lesson_id IN (
  SELECT l.id FROM lessons l JOIN subjects s ON s.id=l.subject_id
  WHERE s.course_id IN ('course-ise', 'course-isie')
    AND (s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW'))
);--> statement-breakpoint

UPDATE course_lessons
SET curriculum_node_id = CASE
    WHEN course_id='course-ise' AND (lesson_id LIKE '%-practice-%') THEN 'curriculum-node-ise-2027-2029-02-01'
    WHEN course_id='course-isie' AND (lesson_id LIKE '%-practice-%' OR lesson_id LIKE '%-security_law-%') THEN 'curriculum-node-isie-2027-2029-02-01'
    WHEN course_id='course-ise' THEN 'curriculum-node-ise-2027-2029-01-04'
    ELSE 'curriculum-node-isie-2027-2029-01-04'
  END,
  lesson_id = NULL,
  display_title = replace(replace(replace(display_title, '[개발용 샘플] ', ''), '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'),
  sort_order = 9800 + CASE
    WHEN id LIKE '%-foundation-%' THEN 1
    WHEN id LIKE '%-practice-%' THEN 2
    WHEN id LIKE '%-review-%' THEN 3
    ELSE 4
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE course_id IN ('course-ise', 'course-isie')
  AND lesson_id IN (
    SELECT l.id FROM lessons l JOIN subjects s ON s.id=l.subject_id
    WHERE s.course_id IN ('course-ise', 'course-isie')
      AND (s.code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW'))
  );--> statement-breakpoint

UPDATE contents
SET title = replace(replace(replace(replace(title, '[개발용 샘플] ', ''), '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'), '평가 대비', '정보보안일반'),
  summary = replace(replace(replace(replace(summary, '[개발용 샘플] ', ''), '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'), '평가 대비', '정보보안일반'),
  body = replace(replace(replace(replace(body, '[개발용 샘플 본문]', ''), '기초 체계', '정보보안일반'), '실무 적용', '정보보안 실무'), '평가 대비', '정보보안일반'),
  updated_at = CURRENT_TIMESTAMP
WHERE id IN (
  SELECT content_id FROM course_lessons
  WHERE course_id IN ('course-ise', 'course-isie') AND sort_order BETWEEN 9801 AND 9804
);--> statement-breakpoint

DELETE FROM lessons
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
  );--> statement-breakpoint

DELETE FROM learning_units
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
  );--> statement-breakpoint

DELETE FROM topics
WHERE subject_id IN (
  SELECT id FROM subjects
  WHERE course_id IN ('course-ise', 'course-isie')
    AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
);--> statement-breakpoint

DELETE FROM subjects
WHERE course_id IN ('course-ise', 'course-isie')
  AND (code IN ('FOUNDATION', 'PRACTICE', 'REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'));--> statement-breakpoint

PRAGMA foreign_key_check;
