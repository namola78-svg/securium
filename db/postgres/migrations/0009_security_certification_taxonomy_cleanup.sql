-- Migrate only 정보보안기사 and 정보보안산업기사 from placeholder taxonomy to the active official curriculum.
BEGIN;

-- Preserve a transaction-local before image for every protected Course and for
-- user-owned rows in the two target Courses. The final assertions roll back the
-- whole migration if an out-of-scope count changes or a user row is deleted.
CREATE TEMP TABLE taxonomy_cleanup_protected_snapshot ON COMMIT DROP AS
SELECT
  c.id AS course_id,
  (SELECT COUNT(*) FROM subjects s WHERE s.course_id = c.id) AS subjects,
  (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE s.course_id = c.id) AS topics,
  (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id = c.id) AS learning_units,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons,
  (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id = c.id) AS questions
FROM courses c
WHERE c.id IN ('course-isms-p', 'course-isrm', 'course-sw-vuln', 'course-cppg', 'course-pia');

CREATE TEMP TABLE taxonomy_cleanup_user_snapshot ON COMMIT DROP AS
SELECT
  c.id AS course_id,
  (SELECT COUNT(*) FROM question_attempts qa WHERE qa.course_id = c.id) AS question_attempts,
  (SELECT COUNT(*) FROM wrong_notes wn WHERE wn.course_id = c.id) AS wrong_notes,
  (SELECT COUNT(*) FROM bookmarks b WHERE b.course_id = c.id) AS bookmarks,
  (SELECT COUNT(*) FROM user_progress up WHERE up.course_id = c.id) AS user_progress,
  (SELECT COUNT(*) FROM user_lesson_progress ulp WHERE ulp.course_id = c.id) AS user_lesson_progress,
  (SELECT COUNT(*) FROM user_course_lesson_progress uclp WHERE uclp.course_id = c.id) AS user_course_lesson_progress,
  (SELECT COUNT(*) FROM review_schedules rs WHERE rs.course_id = c.id) AS review_schedules
FROM courses c
WHERE c.id IN ('course-ise', 'course-isie');

-- PostgreSQL installations can contain only the three legacy sample Subjects.
-- Create the real written-exam hierarchy before moving any references.
WITH security_domains(code, name, description, display_order) AS (
  VALUES
    ('SYSTEM_SECURITY', '시스템보안', '운영체제·서버·클라이언트 환경의 위협과 보안 통제를 학습합니다.', 1),
    ('NETWORK_SECURITY', '네트워크보안', '네트워크 원리, 공격기술과 보안기술을 학습합니다.', 2),
    ('APPLICATION_SECURITY', '애플리케이션보안', '웹·애플리케이션 위협과 안전한 구현·운영 방법을 학습합니다.', 3),
    ('SECURITY_FOUNDATION', '정보보안일반', '암호, 인증, 접근통제와 정보보호 일반 원리를 학습합니다.', 4),
    ('SECURITY_LAW', '정보보안관리 및 법규', '정보보호 관리체계, 위험관리와 관련 법규를 학습합니다.', 5)
)
INSERT INTO subjects
  (id, course_id, code, name, description, display_order, active, is_sample)
SELECT
  c.id || '-subject-' || lower(d.code),
  c.id,
  d.code,
  d.name,
  d.description,
  d.display_order,
  1,
  0
FROM courses c
CROSS JOIN security_domains d
WHERE c.id IN ('course-ise', 'course-isie')
  AND NOT (c.id = 'course-isie' AND d.code = 'SECURITY_LAW')
ON CONFLICT (course_id, code) DO NOTHING;

INSERT INTO topics
  (id, subject_id, parent_topic_id, code, name, description, display_order, active, is_sample)
SELECT
  s.id || '-topic-core',
  s.id,
  NULL,
  'CORE',
  s.name || ' 핵심 주제',
  '공식 출제기준의 주요 항목과 연결되는 과목별 학습 주제입니다.',
  1,
  1,
  0
FROM subjects s
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND s.code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW')
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO learning_units
  (id, course_id, subject_id, topic_id, code, title, description,
   display_order, active, published, completion_policy,
   minimum_progress_percent, minimum_study_seconds, is_sample)
SELECT
  t.id || '-unit',
  s.course_id,
  s.id,
  t.id,
  'UNIT_' || t.code,
  t.name || ' 학습단위',
  '과목별 이론과 문제 학습을 연결하는 학습단위입니다.',
  s.display_order,
  1,
  1,
  'MANUAL',
  100,
  0,
  0
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND s.code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW')
ON CONFLICT (subject_id, code) DO NOTHING;

INSERT INTO lessons
  (id, learning_unit_id, course_id, subject_id, topic_id, code, title, summary,
   content, content_format, estimated_minutes, display_order, active, published, is_sample)
SELECT
  t.id || '-lesson-01',
  t.id || '-unit',
  s.course_id,
  s.id,
  t.id,
  'LESSON_01',
  s.name || ' 핵심 이론',
  s.name || '의 핵심 개념과 시험 적용 관점을 정리합니다.',
  '# ' || s.name || chr(10) || chr(10) ||
    '공식 출제기준의 주요 항목을 기준으로 핵심 개념, 대표 위협, 대응 원리와 문제 적용 관점을 학습합니다.' ||
    chr(10) || chr(10) ||
    '세부 이론과 문제는 공식 CurriculumNode에 연결된 CourseLesson에서 이어서 학습합니다.',
  'MARKDOWN',
  10,
  1,
  1,
  1,
  0
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND s.code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (s.course_id = 'course-isie' AND s.code = 'SECURITY_LAW')
ON CONFLICT (topic_id, code) DO NOTHING;

UPDATE courses SET
  description = CASE id
    WHEN 'course-ise' THEN '정보보안기사 필기·실기 공식 출제기준 기반 학습 과정'
    WHEN 'course-isie' THEN '정보보안산업기사 필기·실기 공식 출제기준 기반 학습 과정'
  END,
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP::text
WHERE id IN ('course-ise', 'course-isie');

UPDATE subjects SET
  name = CASE code
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
    WHEN 'SYSTEM_SECURITY' THEN 1 WHEN 'NETWORK_SECURITY' THEN 2
    WHEN 'APPLICATION_SECURITY' THEN 3 WHEN 'SECURITY_FOUNDATION' THEN 4 ELSE 5
  END,
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise', 'course-isie')
  AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
  AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW');

UPDATE topics SET
  name = (SELECT s.name || ' 핵심 주제' FROM subjects s WHERE s.id = topics.subject_id),
  description = '공식 출제기준의 주요 항목과 연결되는 과목별 학습 주제입니다.',
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP::text
WHERE subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise', 'course-isie')
    AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
    AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
);

UPDATE learning_units SET
  title = (SELECT t.name || ' 학습단위' FROM topics t WHERE t.id = learning_units.topic_id),
  description = '과목별 이론과 문제 학습을 연결하는 학습단위입니다.',
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects WHERE course_id IN ('course-ise', 'course-isie')
      AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
      AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
  );

UPDATE lessons SET
  title = (SELECT s.name || ' 핵심 이론' FROM subjects s WHERE s.id = lessons.subject_id),
  summary = (SELECT s.name || '의 핵심 개념과 시험 적용 관점을 정리합니다.' FROM subjects s WHERE s.id = lessons.subject_id),
  content = replace(replace(replace(content, '[개발용 샘플 본문]', ''), '[개발용 샘플]', ''), '개발용 콘텐츠', '학습 콘텐츠'),
  is_sample = 0,
  updated_at = CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise', 'course-isie')
  AND subject_id IN (
    SELECT id FROM subjects WHERE course_id IN ('course-ise', 'course-isie')
      AND code IN ('SYSTEM_SECURITY', 'NETWORK_SECURITY', 'APPLICATION_SECURITY', 'SECURITY_FOUNDATION', 'SECURITY_LAW')
      AND NOT (course_id = 'course-isie' AND code = 'SECURITY_LAW')
  );

INSERT INTO question_courses (question_id, course_id, weight)
SELECT id, 'course-ise', 100 FROM questions
WHERE source = 'SECURIUM_CONTENT_UPGRADE_V2' AND id LIKE 'sec-upgrade-practical-%'
ON CONFLICT (question_id, course_id) DO NOTHING;

DELETE FROM question_courses
WHERE course_id = 'course-isie'
  AND question_id IN (
    SELECT id FROM questions WHERE source='SECURIUM_CONTENT_UPGRADE_V2' AND id LIKE 'sec-upgrade-practical-%'
  );

INSERT INTO question_subjects (question_id, subject_id)
SELECT DISTINCT qs.question_id,
  CASE
    WHEN q.source='SECURIUM_CONTENT_UPGRADE_V2' AND q.id LIKE 'sec-upgrade-practical-%' THEN
      CASE
        WHEN q.title LIKE '%SQL injection%' OR q.title LIKE '%Web and API%' THEN 'course-ise-subject-application_security'
        WHEN q.title LIKE '%ARP spoofing%' OR q.title LIKE '%Email authentication%' OR q.title LIKE '%IDS and IPS%' THEN 'course-ise-subject-network_security'
        WHEN q.title LIKE '%Linux security%' OR q.title LIKE '%Windows security%' OR q.title LIKE '%Forensics%' THEN 'course-ise-subject-system_security'
        WHEN q.title LIKE '%Risk management%' OR q.title LIKE '%BCP and disaster recovery%' THEN 'course-ise-subject-security_law'
        ELSE 'course-ise-subject-security_foundation'
      END
    WHEN s.course_id='course-isie' AND s.code='SECURITY_LAW' THEN 'course-isie-subject-security_foundation'
    WHEN q.source LIKE '%network security%' OR q.source LIKE '%ARP spoofing%' THEN s.course_id || '-subject-network_security'
    WHEN q.source LIKE '%system security%' OR q.source LIKE '%Linux file permission%' THEN s.course_id || '-subject-system_security'
    ELSE s.course_id || '-subject-security_foundation'
  END
FROM question_subjects qs
JOIN subjects s ON s.id=qs.subject_id
JOIN questions q ON q.id=qs.question_id
WHERE s.course_id IN ('course-ise','course-isie')
  AND (s.code IN ('FOUNDATION','PRACTICE','REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW'))
ON CONFLICT (question_id, subject_id) DO NOTHING;

INSERT INTO question_subjects (question_id, subject_id)
SELECT qc.question_id,
  CASE
    WHEN q.source='SECURIUM independently authored application security sample' THEN qc.course_id || '-subject-application_security'
    ELSE 'course-ise-subject-security_law'
  END
FROM question_courses qc JOIN questions q ON q.id=qc.question_id
WHERE qc.course_id IN ('course-ise','course-isie')
  AND (q.source='SECURIUM independently authored application security sample'
    OR (qc.course_id='course-ise' AND q.source='SECURIUM independently authored management law sample'))
ON CONFLICT (question_id, subject_id) DO NOTHING;

INSERT INTO question_topics (question_id, topic_id)
SELECT qs.question_id, qs.subject_id || '-topic-core'
FROM question_subjects qs JOIN subjects s ON s.id=qs.subject_id
WHERE s.course_id IN ('course-ise','course-isie')
  AND s.code IN ('SYSTEM_SECURITY','NETWORK_SECURITY','APPLICATION_SECURITY','SECURITY_FOUNDATION','SECURITY_LAW')
  AND NOT (s.course_id='course-isie' AND s.code='SECURITY_LAW')
ON CONFLICT (question_id, topic_id) DO NOTHING;

DELETE FROM question_topics WHERE topic_id IN (
  SELECT t.id FROM topics t JOIN subjects s ON s.id=t.subject_id
  WHERE s.course_id IN ('course-ise','course-isie')
    AND (s.code IN ('FOUNDATION','PRACTICE','REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW'))
);
DELETE FROM question_subjects WHERE subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
    AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
);

UPDATE user_progress SET
  subject_id=course_id || '-subject-security_foundation',
  topic_id=course_id || '-subject-security_foundation-topic-core',
  updated_at=CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise','course-isie')
  AND subject_id IN (SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie') AND code IN ('FOUNDATION','PRACTICE','REVIEW'));

UPDATE bookmarks SET target_id=CASE target_type
    WHEN 'SUBJECT' THEN course_id || '-subject-security_foundation'
    WHEN 'TOPIC' THEN course_id || '-subject-security_foundation-topic-core'
    ELSE target_id END
WHERE course_id IN ('course-ise','course-isie')
  AND (target_id IN (SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie') AND code IN ('FOUNDATION','PRACTICE','REVIEW'))
    OR target_id IN (SELECT t.id FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND s.code IN ('FOUNDATION','PRACTICE','REVIEW')));

UPDATE review_schedules SET target_id=course_id || '-subject-security_foundation-topic-core', updated_at=CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise','course-isie') AND target_type='TOPIC'
  AND target_id IN (SELECT t.id FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.course_id IN ('course-ise','course-isie') AND s.code IN ('FOUNDATION','PRACTICE','REVIEW'));

UPDATE mock_exam_sections SET subject_id=CASE WHEN subject_id LIKE 'course-ise-%'
  THEN 'course-ise-subject-security_foundation' ELSE 'course-isie-subject-security_foundation' END
WHERE subject_id IN (SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
  AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW')));

UPDATE lectures SET
  subject_id=course_id || '-subject-security_foundation',
  topic_id=course_id || '-subject-security_foundation-topic-core',
  title=replace(replace(replace(replace(title,'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),'정보보안 관리 및 법규','정보보안일반'),
  updated_at=CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise','course-isie') AND subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
    AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'))
);

UPDATE audio_contents SET
  lesson_id=CASE WHEN lesson_id LIKE 'course-ise-%' THEN 'course-ise-subject-security_foundation-topic-core-lesson-01' ELSE 'course-isie-subject-security_foundation-topic-core-lesson-01' END,
  title=replace(replace(replace(replace(title,'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),'정보보안 관리 및 법규','정보보안일반'),
  updated_at=CURRENT_TIMESTAMP::text
WHERE lesson_id IN (SELECT l.id FROM lessons l JOIN subjects s ON s.id=l.subject_id
  WHERE s.course_id IN ('course-ise','course-isie')
    AND (s.code IN ('FOUNDATION','PRACTICE','REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW')));

UPDATE course_lessons SET
  curriculum_node_id=CASE
    WHEN course_id='course-ise' AND lesson_id LIKE '%-practice-%' THEN 'curriculum-node-ise-2027-2029-02-01'
    WHEN course_id='course-isie' AND (lesson_id LIKE '%-practice-%' OR lesson_id LIKE '%-security_law-%') THEN 'curriculum-node-isie-2027-2029-02-01'
    WHEN course_id='course-ise' THEN 'curriculum-node-ise-2027-2029-01-04'
    ELSE 'curriculum-node-isie-2027-2029-01-04' END,
  lesson_id=NULL,
  display_title=replace(replace(replace(replace(display_title,'[개발용 샘플] ',''),'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),
  sort_order=9800+CASE WHEN id LIKE '%-foundation-%' THEN 1 WHEN id LIKE '%-practice-%' THEN 2 WHEN id LIKE '%-review-%' THEN 3 ELSE 4 END,
  updated_at=CURRENT_TIMESTAMP::text
WHERE course_id IN ('course-ise','course-isie') AND lesson_id IN (
  SELECT l.id FROM lessons l JOIN subjects s ON s.id=l.subject_id
  WHERE s.course_id IN ('course-ise','course-isie')
    AND (s.code IN ('FOUNDATION','PRACTICE','REVIEW') OR (s.course_id='course-isie' AND s.code='SECURITY_LAW'))
);

UPDATE contents SET
  title=replace(replace(replace(replace(title,'[개발용 샘플] ',''),'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),
  summary=replace(replace(replace(replace(summary,'[개발용 샘플] ',''),'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),
  body=replace(replace(replace(replace(body,'[개발용 샘플 본문]',''),'기초 체계','정보보안일반'),'실무 적용','정보보안 실무'),'평가 대비','정보보안일반'),
  updated_at=CURRENT_TIMESTAMP::text
WHERE id IN (SELECT content_id FROM course_lessons WHERE course_id IN ('course-ise','course-isie') AND sort_order BETWEEN 9801 AND 9804);

DELETE FROM lessons WHERE course_id IN ('course-ise','course-isie') AND subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
    AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW')));
DELETE FROM learning_units WHERE course_id IN ('course-ise','course-isie') AND subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
    AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW')));
DELETE FROM topics WHERE subject_id IN (
  SELECT id FROM subjects WHERE course_id IN ('course-ise','course-isie')
    AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW')));
DELETE FROM subjects WHERE course_id IN ('course-ise','course-isie')
  AND (code IN ('FOUNDATION','PRACTICE','REVIEW') OR (course_id='course-isie' AND code='SECURITY_LAW'));

CREATE TEMP TABLE taxonomy_cleanup_protected_current ON COMMIT DROP AS
SELECT
  c.id AS course_id,
  (SELECT COUNT(*) FROM subjects s WHERE s.course_id = c.id) AS subjects,
  (SELECT COUNT(*) FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE s.course_id = c.id) AS topics,
  (SELECT COUNT(*) FROM learning_units lu WHERE lu.course_id = c.id) AS learning_units,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons,
  (SELECT COUNT(DISTINCT qc.question_id) FROM question_courses qc WHERE qc.course_id = c.id) AS questions
FROM courses c
WHERE c.id IN ('course-isms-p', 'course-isrm', 'course-sw-vuln', 'course-cppg', 'course-pia');

CREATE TEMP TABLE taxonomy_cleanup_user_current ON COMMIT DROP AS
SELECT
  c.id AS course_id,
  (SELECT COUNT(*) FROM question_attempts qa WHERE qa.course_id = c.id) AS question_attempts,
  (SELECT COUNT(*) FROM wrong_notes wn WHERE wn.course_id = c.id) AS wrong_notes,
  (SELECT COUNT(*) FROM bookmarks b WHERE b.course_id = c.id) AS bookmarks,
  (SELECT COUNT(*) FROM user_progress up WHERE up.course_id = c.id) AS user_progress,
  (SELECT COUNT(*) FROM user_lesson_progress ulp WHERE ulp.course_id = c.id) AS user_lesson_progress,
  (SELECT COUNT(*) FROM user_course_lesson_progress uclp WHERE uclp.course_id = c.id) AS user_course_lesson_progress,
  (SELECT COUNT(*) FROM review_schedules rs WHERE rs.course_id = c.id) AS review_schedules
FROM courses c
WHERE c.id IN ('course-ise', 'course-isie');

DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM taxonomy_cleanup_protected_snapshot EXCEPT SELECT * FROM taxonomy_cleanup_protected_current)
    UNION ALL
    (SELECT * FROM taxonomy_cleanup_protected_current EXCEPT SELECT * FROM taxonomy_cleanup_protected_snapshot)
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_PROTECTED_COURSE_CHANGED';
  END IF;

  IF EXISTS (
    (SELECT * FROM taxonomy_cleanup_user_snapshot EXCEPT SELECT * FROM taxonomy_cleanup_user_current)
    UNION ALL
    (SELECT * FROM taxonomy_cleanup_user_current EXCEPT SELECT * FROM taxonomy_cleanup_user_snapshot)
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_USER_ROW_COUNT_CHANGED';
  END IF;

  IF (SELECT COUNT(*) FROM subjects WHERE course_id = 'course-ise' AND deleted_at IS NULL) <> 5
    OR (SELECT COUNT(*) FROM subjects WHERE course_id = 'course-isie' AND deleted_at IS NULL) <> 4 THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_SUBJECT_COUNT_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1 FROM subjects
    WHERE course_id IN ('course-ise', 'course-isie')
      AND (is_sample = 1 OR code IN ('FOUNDATION', 'PRACTICE', 'REVIEW')
        OR name LIKE '%기초 체계%' OR name LIKE '%실무 적용%' OR name LIKE '%평가 대비%')
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_PLACEHOLDER_REMAINS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM question_courses qc
    WHERE qc.course_id IN ('course-ise', 'course-isie')
      AND NOT EXISTS (
        SELECT 1 FROM question_subjects qs JOIN subjects s ON s.id = qs.subject_id
        WHERE qs.question_id = qc.question_id AND s.course_id = qc.course_id
      )
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_QUESTION_SUBJECT_ORPHAN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM question_courses qc
    WHERE qc.course_id IN ('course-ise', 'course-isie')
      AND NOT EXISTS (
        SELECT 1
        FROM question_topics qt
        JOIN topics t ON t.id = qt.topic_id
        JOIN subjects s ON s.id = t.subject_id
        WHERE qt.question_id = qc.question_id AND s.course_id = qc.course_id
      )
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_QUESTION_TOPIC_ORPHAN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM question_topics qt
    JOIN topics t ON t.id = qt.topic_id
    JOIN subjects ts ON ts.id = t.subject_id
    JOIN question_courses qc ON qc.question_id = qt.question_id AND qc.course_id = ts.course_id
    WHERE qc.course_id IN ('course-ise', 'course-isie')
      AND NOT EXISTS (
        SELECT 1 FROM question_subjects qs
        WHERE qs.question_id = qt.question_id AND qs.subject_id = t.subject_id
      )
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_SUBJECT_TOPIC_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_lessons cl
    JOIN curriculum_nodes cn ON cn.id = cl.curriculum_node_id
    JOIN curriculum_trees ct ON ct.id = cn.curriculum_tree_id
    WHERE cl.course_id IN ('course-ise', 'course-isie')
      AND ct.course_id <> cl.course_id
  ) THEN
    RAISE EXCEPTION 'SECURITY_TAXONOMY_CONTENT_COURSE_MISMATCH';
  END IF;
END $$;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0009_security_certification_taxonomy_cleanup', 'manual-security-certification-taxonomy-cleanup')
ON CONFLICT (id) DO NOTHING;

COMMIT;
