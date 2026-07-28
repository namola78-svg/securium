PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles (id, code, name, description) VALUES
  ('role-user', 'USER', '학습자', '[개발용 샘플] 일반 학습자 역할'),
  ('role-course-manager', 'COURSE_MANAGER', '과정 관리자', '[개발용 샘플] 과정 구성 관리 역할'),
  ('role-content-editor', 'CONTENT_EDITOR', '콘텐츠 편집자', '[개발용 샘플] 콘텐츠 작성 역할'),
  ('role-content-reviewer', 'CONTENT_REVIEWER', '콘텐츠 검수자', '[개발용 샘플] 콘텐츠 검수 역할'),
  ('role-admin', 'ADMIN', '관리자', '[개발용 샘플] 플랫폼 운영 역할'),
  ('role-super-admin', 'SUPER_ADMIN', '최고 관리자', '[개발용 샘플] 전체 관리 역할');

INSERT OR IGNORE INTO users (id, email, display_name, status) VALUES
  ('user-super-admin', 'dev-super-admin@example.invalid', '개발용 최고 관리자', 'ACTIVE'),
  ('user-admin', 'dev-admin@example.invalid', '개발용 관리자', 'ACTIVE'),
  ('user-learner-1', 'dev-user-1@example.invalid', '개발용 학습자 1', 'ACTIVE'),
  ('user-learner-2', 'dev-user-2@example.invalid', '개발용 학습자 2', 'ACTIVE');

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, granted_by) VALUES
  ('user-role-super-admin', 'user-super-admin', 'role-super-admin', 'user-super-admin'),
  ('user-role-admin', 'user-admin', 'role-admin', 'user-super-admin'),
  ('user-role-learner-1', 'user-learner-1', 'role-user', 'user-super-admin'),
  ('user-role-learner-2', 'user-learner-2', 'role-user', 'user-super-admin');

INSERT OR IGNORE INTO course_groups
  (id, code, name, description, display_order, active, is_sample)
VALUES
  ('group-national-security', 'NATIONAL_SECURITY_CERT', '정보보안 국가기술자격', '[개발용 샘플] 정보보안기사와 정보보안산업기사 과정군', 1, 1, 1),
  ('group-independent', 'INDEPENDENT_PROFESSIONAL', '독립 전문과정', '[개발용 샘플] 정보보호·개인정보보호 독립 전문과정', 2, 1, 1);

INSERT OR IGNORE INTO courses
  (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample)
VALUES
  ('course-isms-p', 'group-independent', 'ISMS_P', 'isms-p', 'ISMS-P', 'ISMS-P', '[개발용 샘플] 정보보호 및 개인정보보호 관리체계 학습 과정', 100, 70, 'INTERMEDIATE', 1, 1, 1, 1),
  ('course-ise', 'group-national-security', 'ISE', 'information-security-engineer', '정보보안기사', '정보보안기사', '[개발용 샘플] 정보보안기사 필기·실기 공통 기반 과정', 100, 60, 'INTERMEDIATE', 1, 1, 2, 1),
  ('course-isie', 'group-national-security', 'ISIE', 'information-security-industrial-engineer', '정보보안산업기사', '정보보안산업기사', '[개발용 샘플] 정보보안산업기사 필기·실기 공통 기반 과정', 100, 60, 'BEGINNER', 1, 1, 3, 1),
  ('course-isrm', 'group-independent', 'ISRM', 'isrm', '정보보호위험관리사(ISRM)', 'ISRM', '[개발용 샘플] 정보보호 위험 식별·분석·대응 과정', 100, 70, 'ADVANCED', 1, 1, 4, 1),
  ('course-sw-vuln', 'group-independent', 'SW_VULN_DIAG', 'sw-vulnerability-diagnostician', 'SW 보안약점 진단원', 'SW 보안약점', '[개발용 샘플] 소프트웨어 보안약점 진단 실무 과정', 100, 70, 'ADVANCED', 1, 1, 5, 1),
  ('course-cppg', 'group-independent', 'CPPG', 'cppg', 'CPPG 개인정보관리사', 'CPPG', '[개발용 샘플] 개인정보보호 법·제도 및 관리 실무 과정', 100, 70, 'INTERMEDIATE', 1, 1, 6, 1),
  ('course-pia', 'group-independent', 'PIA', 'privacy-impact-assessment', '개인정보 영향평가', '개인정보 영향평가', '[개발용 샘플] 개인정보 영향평가 수행 기반 과정', 100, 70, 'ADVANCED', 1, 1, 7, 1);

WITH subject_templates(code, name, description, display_order) AS (
  VALUES
    ('FOUNDATION', '기초 체계', '[개발용 샘플] 핵심 개념과 용어를 학습합니다.', 1),
    ('PRACTICE', '실무 적용', '[개발용 샘플] 현업 적용 관점에서 학습합니다.', 2),
    ('REVIEW', '평가 대비', '[개발용 샘플] 주요 확인사항을 정리합니다.', 3)
)
INSERT OR IGNORE INTO subjects
  (id, course_id, code, name, description, display_order, active, is_sample)
SELECT
  c.id || '-subject-' || lower(s.code),
  c.id,
  s.code,
  c.short_name || ' · ' || s.name,
  s.description,
  s.display_order,
  1,
  1
FROM courses c
CROSS JOIN subject_templates s
WHERE c.is_sample = 1;

INSERT OR IGNORE INTO topics
  (id, subject_id, parent_topic_id, code, name, description, display_order, active, is_sample)
SELECT
  s.id || '-topic-core',
  s.id,
  NULL,
  'CORE',
  s.name || ' 핵심 주제',
  '[개발용 샘플] Phase 1 구조 검증을 위한 준비 중 주제입니다.',
  1,
  1,
  1
FROM subjects s
WHERE s.is_sample = 1;

INSERT OR IGNORE INTO learning_units
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
  '[개발용 샘플] 본문형 이론 레슨을 묶는 학습단위입니다.',
  t.display_order,
  1,
  1,
  'MANUAL',
  100,
  0,
  1
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.is_sample = 1
  AND s.is_sample = 1;

-- Development-only body lessons. Content is independently authored sample text.
INSERT OR IGNORE INTO lessons
  (id, learning_unit_id, course_id, subject_id, topic_id, code, title, summary, content,
   content_format, estimated_minutes, display_order, active, published, is_sample)
SELECT
  t.id || '-lesson-01',
  t.id || '-unit',
  s.course_id,
  s.id,
  t.id,
  'LESSON_01',
  '[개발용 샘플] ' || s.name || ' 핵심 이론',
  '[개발용 샘플] ' || t.name || '의 기본 개념과 학습 기록 원칙을 설명합니다.',
  '[개발용 샘플 본문]' || char(10) || char(10) ||
  '이 레슨은 플랫폼 기능 검증을 위해 독립적으로 작성한 개발용 콘텐츠입니다.' ||
  char(10) || char(10) ||
  '학습할 때는 적용 범위와 보호 목적을 먼저 확인하고, 판단 근거와 변경 이력을 남겨야 합니다.' ||
  char(10) || char(10) ||
  '실제 시험·법령·인증 기준을 대신하지 않으므로 운영 콘텐츠는 관리자가 기준일과 출처를 검토한 뒤 별도로 게시해야 합니다.',
  'PLAIN_TEXT',
  10,
  1,
  1,
  1,
  1
FROM topics t
JOIN subjects s ON s.id = t.subject_id
WHERE t.is_sample = 1
  AND s.is_sample = 1;

-- Development-only audio metadata. No instructor recording or official voice is bundled.
-- An empty audio_url intentionally activates the optional browser-provided speech synthesis fallback.
INSERT OR IGNORE INTO audio_contents
  (id, lesson_id, title, audio_url, transcript, transcript_segments_json,
   duration_seconds, voice_provider, voice_name, speed_options_json, published)
SELECT
  l.id || '-audio-01',
  l.id,
  '[개발용 샘플] ' || l.title || ' 오디오 요약',
  '',
  '[개발용 샘플] 이 오디오는 브라우저 제공 음성 합성으로 레슨의 핵심 학습 원칙을 안내합니다. 적용 범위와 보호 목적을 확인하고 판단 근거와 변경 이력을 남기세요. 실제 강사 음성이나 공식 기관 음성이 아닙니다.',
  '[{"startSeconds":0,"endSeconds":30,"text":"이 오디오는 브라우저 제공 음성 합성으로 레슨의 핵심 학습 원칙을 안내합니다."},{"startSeconds":30,"endSeconds":60,"text":"적용 범위와 보호 목적을 확인하고 판단 근거와 변경 이력을 남기세요."},{"startSeconds":60,"endSeconds":90,"text":"실제 강사 음성이나 공식 기관 음성이 아닌 개발용 샘플입니다."}]',
  90,
  'BROWSER_SPEECH_SYNTHESIS',
  '사용자 기기 기본 음성',
  '[0.75,1,1.25,1.5,2]',
  1
FROM lessons l
WHERE l.is_sample = 1;

INSERT OR IGNORE INTO audio_contents
  (id, lesson_id, title, audio_url, transcript, transcript_segments_json,
   duration_seconds, voice_provider, voice_name, speed_options_json, published)
VALUES
  (
    'private-audio-pia-sample',
    'course-pia-subject-foundation-topic-core-lesson-01',
    '[개발용 비공개 샘플] 영향평가 오디오',
    '',
    '비공개 접근통제 검증용 개발 데이터입니다.',
    '[]',
    30,
    'BROWSER_SPEECH_SYNTHESIS',
    '사용자 기기 기본 음성',
    '[1,1.25,1.5]',
    0
  );

-- Development-only Mock lecture embeds. They verify provider integration and
-- are not official course lectures or instructor-produced materials.
INSERT OR IGNORE INTO lectures
  (id, course_id, subject_id, topic_id, title, instructor_name, description,
   video_provider, video_url, thumbnail_url, duration_seconds, free, published,
   display_order, is_sample)
SELECT
  s.id || '-lecture-01',
  s.course_id,
  s.id,
  s.id || '-topic-core',
  '[개발용 Mock 강의] ' || s.name,
  '개발용 가상 강사',
  '[개발용 Mock] 영상 Provider, 이어보기, 메모와 접근통제 검증용 강의입니다.',
  CASE WHEN s.display_order = 2 THEN 'VIMEO' ELSE 'YOUTUBE' END,
  CASE
    WHEN s.display_order = 2 THEN 'https://vimeo.com/76979871'
    ELSE 'https://www.youtube.com/watch?v=M7lc1UVf-VE'
  END,
  '',
  CASE WHEN s.display_order = 2 THEN 600 ELSE 450 END,
  CASE WHEN s.display_order = 1 THEN 1 ELSE 0 END,
  1,
  s.display_order,
  1
FROM subjects s
WHERE s.is_sample = 1;

INSERT OR IGNORE INTO lectures
  (id, course_id, subject_id, topic_id, title, instructor_name, description,
   video_provider, video_url, thumbnail_url, duration_seconds, free, published,
   display_order, is_sample)
VALUES
  (
    'private-lecture-pia-sample',
    'course-pia',
    'course-pia-subject-foundation',
    'course-pia-subject-foundation-topic-core',
    '[개발용 비공개 Mock 강의] 영향평가',
    '개발용 가상 강사',
    '비공개 접근통제 검증용 강의입니다.',
    'YOUTUBE',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    '',
    300,
    1,
    0,
    98,
    1
  ),
  (
    'invalid-url-lecture-pia-sample',
    'course-pia',
    'course-pia-subject-foundation',
    'course-pia-subject-foundation-topic-core',
    '[개발용 차단 Mock 강의] 허용되지 않은 URL',
    '개발용 가상 강사',
    'URL allowlist 접근통제 검증용 강의입니다.',
    'YOUTUBE',
    'javascript:alert(1)',
    '',
    300,
    1,
    1,
    99,
    1
  );

UPDATE lessons
SET learning_unit_id = topic_id || '-unit'
WHERE learning_unit_id IS NULL
  AND EXISTS (
    SELECT 1 FROM learning_units lu
    WHERE lu.id = lessons.topic_id || '-unit'
  );

INSERT OR IGNORE INTO user_course_enrollments
  (id, user_id, course_id, status, current_level, progress_percent, total_xp)
VALUES
  ('enrollment-user1-isms', 'user-learner-1', 'course-isms-p', 'ACTIVE', 4, 12, 120),
  ('enrollment-user1-cppg', 'user-learner-1', 'course-cppg', 'ACTIVE', 2, 5, 40),
  ('enrollment-user2-ise', 'user-learner-2', 'course-ise', 'PAUSED', 1, 2, 10);

INSERT OR IGNORE INTO user_progress
  (id, user_id, course_id, subject_id, topic_id, progress_percent, completed_lessons, completed_questions, correct_answers, total_answers, last_studied_at)
SELECT
  'progress-user1-isms',
  'user-learner-1',
  'course-isms-p',
  s.id,
  t.id,
  35,
  3,
  10,
  8,
  10,
  CURRENT_TIMESTAMP
FROM subjects s
JOIN topics t ON t.subject_id = s.id
WHERE s.course_id = 'course-isms-p'
ORDER BY s.display_order
LIMIT 1;

-- Phase 2 development-only identities and role separation.
INSERT OR IGNORE INTO users (id, email, display_name, status) VALUES
  ('user-content-editor', 'dev-editor@example.invalid', '개발용 문제 작성자', 'ACTIVE'),
  ('user-content-reviewer', 'dev-reviewer@example.invalid', '개발용 문제 검수자', 'ACTIVE');

INSERT OR IGNORE INTO user_roles (id, user_id, role_id, granted_by) VALUES
  ('user-role-content-editor', 'user-content-editor', 'role-content-editor', 'user-super-admin'),
  ('user-role-content-reviewer', 'user-content-reviewer', 'role-content-reviewer', 'user-super-admin'),
  ('user-role-admin-course-manager', 'user-admin', 'role-course-manager', 'user-super-admin'),
  ('user-role-admin-content-editor', 'user-admin', 'role-content-editor', 'user-super-admin'),
  ('user-role-admin-content-reviewer', 'user-admin', 'role-content-reviewer', 'user-super-admin');

-- 7 courses x 15 original development samples = 105 published questions.
WITH RECURSIVE sample_numbers(n) AS (
  VALUES(1)
  UNION ALL
  SELECT n + 1 FROM sample_numbers WHERE n < 15
)
INSERT OR IGNORE INTO questions
  (id, title, content, type, difficulty, explanation, wrong_answer_explanation,
   status, source, source_date, version, answer_config_json, is_sample,
   created_by, reviewed_by, published_at)
SELECT
  c.id || '-question-' || printf('%02d', n),
  '[개발용 샘플] ' || c.short_name || ' 통합 문제 ' || printf('%02d', n),
  CASE n % 4
    WHEN 1 THEN c.short_name || ' 학습에서 위험 기반 판단은 중요한 원칙이다.'
    WHEN 2 THEN c.short_name || ' 학습 절차에서 가장 먼저 확인할 항목을 고르세요.'
    WHEN 3 THEN c.short_name || ' 학습 기록의 신뢰성을 높이는 조치를 모두 고르세요.'
    ELSE c.short_name || ' 학습에서 정보자산을 지키기 위한 조치를 한 단어로 입력하세요.'
  END,
  CASE n % 4
    WHEN 1 THEN 'TRUE_FALSE'
    WHEN 2 THEN 'SINGLE_CHOICE'
    WHEN 3 THEN 'MULTIPLE_CHOICE'
    ELSE 'SHORT_ANSWER'
  END,
  CASE n % 3 WHEN 1 THEN 'EASY' WHEN 2 THEN 'MEDIUM' ELSE 'HARD' END,
  '[개발용 샘플 해설] 위험을 식별하고 근거와 변경 이력을 남기는 것이 핵심입니다.',
  '[개발용 샘플 오답 해설] 선택한 답과 통제 목적의 연결 관계를 다시 확인하세요.',
  'PUBLISHED',
  'Shield Academy 독립 제작 개발용 샘플',
  '2026-07-27',
  1,
  CASE WHEN n % 4 = 0
    THEN '{"ignoreCase":true,"normalizeWhitespace":true,"acceptedAnswers":["보호조치","security"],"synonyms":["보안조치"],"useRegex":false,"partialCreditRules":[]}'
    ELSE '{}'
  END,
  1,
  'user-admin',
  'user-content-reviewer',
  CURRENT_TIMESTAMP
FROM courses c
CROSS JOIN sample_numbers
WHERE c.is_sample = 1;

INSERT OR IGNORE INTO question_choices
  (id, question_id, content, display_order, is_correct, explanation)
SELECT
  q.id || '-choice-' || printf('%02d', choice_no),
  q.id,
  CASE
    WHEN q.type = 'TRUE_FALSE' AND choice_no = 1 THEN '참'
    WHEN q.type = 'TRUE_FALSE' THEN '거짓'
    WHEN q.type = 'SINGLE_CHOICE' AND choice_no = 1 THEN '위험과 적용 범위 확인'
    WHEN q.type = 'SINGLE_CHOICE' AND choice_no = 2 THEN '근거 없이 결과 확정'
    WHEN q.type = 'SINGLE_CHOICE' AND choice_no = 3 THEN '기록 없이 즉시 종료'
    WHEN q.type = 'SINGLE_CHOICE' THEN '권한 검증 생략'
    WHEN q.type = 'MULTIPLE_CHOICE' AND choice_no = 1 THEN '변경 이력 기록'
    WHEN q.type = 'MULTIPLE_CHOICE' AND choice_no = 2 THEN '공용 계정 사용'
    WHEN q.type = 'MULTIPLE_CHOICE' AND choice_no = 3 THEN '최소 권한 적용'
    WHEN q.type = 'MULTIPLE_CHOICE' THEN '민감정보 평문 로그'
    ELSE '보호조치'
  END,
  choice_no,
  CASE
    WHEN q.type IN ('TRUE_FALSE', 'SINGLE_CHOICE', 'SHORT_ANSWER') AND choice_no = 1 THEN 1
    WHEN q.type = 'MULTIPLE_CHOICE' AND choice_no IN (1, 3) THEN 1
    ELSE 0
  END,
  CASE
    WHEN choice_no = 1 THEN '[개발용 샘플] 통제 목적에 부합하는 선택지입니다.'
    WHEN q.type = 'MULTIPLE_CHOICE' AND choice_no = 3 THEN '[개발용 샘플] 최소 권한은 기본 보호조치입니다.'
    ELSE '[개발용 샘플] 통제 목적과 일치하지 않습니다.'
  END
FROM questions q
JOIN (
  SELECT 1 AS choice_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
) choices
WHERE q.is_sample = 1
  AND (
    (q.type = 'TRUE_FALSE' AND choice_no <= 2)
    OR q.type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE')
    OR (q.type = 'SHORT_ANSWER' AND choice_no = 1)
  );

INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
SELECT q.id, c.id, 100
FROM questions q
JOIN courses c ON q.id LIKE c.id || '-question-%'
WHERE q.is_sample = 1;

-- Demonstrates that one shared question can belong to multiple courses.
INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
VALUES ('course-isms-p-question-01', 'course-cppg', 80);

INSERT OR IGNORE INTO question_subjects (question_id, subject_id)
SELECT
  q.id,
  s.id
FROM questions q
JOIN courses c ON q.id LIKE c.id || '-question-%'
JOIN subjects s
  ON s.course_id = c.id
 AND s.display_order = ((CAST(substr(q.id, -2) AS INTEGER) - 1) % 3) + 1
WHERE q.is_sample = 1;

INSERT OR IGNORE INTO question_subjects (question_id, subject_id)
SELECT 'course-isms-p-question-01', s.id
FROM subjects s
WHERE s.course_id = 'course-cppg' AND s.display_order = 1
LIMIT 1;

INSERT OR IGNORE INTO question_topics (question_id, topic_id)
SELECT qs.question_id, t.id
FROM question_subjects qs
JOIN topics t ON t.subject_id = qs.subject_id
WHERE t.display_order = 1;

INSERT OR IGNORE INTO question_versions
  (id, question_id, version, snapshot_json, review_comment, created_by)
SELECT
  q.id || '-version-01',
  q.id,
  1,
  json_object(
    'id', q.id,
    'title', q.title,
    'content', q.content,
    'type', q.type,
    'difficulty', q.difficulty,
    'status', q.status,
    'sample', 1
  ),
  '[개발용 샘플] Seed 생성 및 검수 완료',
  'user-admin'
FROM questions q
WHERE q.is_sample = 1;

-- Phase 3: three DB-managed learning levels per development course.
WITH level_templates(number, code, title, description, passing_score, display_order) AS (
  VALUES
    (1, 'FOUNDATION', '핵심 개념', '[개발용 샘플] 과정의 핵심 용어와 기본 원칙을 학습합니다.', 60, 1),
    (2, 'PRACTICE', '실무 적용', '[개발용 샘플] 사례를 통해 통제와 절차를 적용합니다.', 70, 2),
    (3, 'MASTERY', '종합 숙달', '[개발용 샘플] 취약 영역을 점검하고 종합 문제를 풉니다.', 80, 3)
)
INSERT OR IGNORE INTO levels
  (id, course_id, code, number, title, description, passing_score,
   required_level_id, display_order, active, published)
SELECT
  c.id || '-level-' || l.number,
  c.id,
  l.code,
  l.number,
  c.short_name || ' · ' || l.title,
  l.description,
  l.passing_score,
  CASE WHEN l.number = 1 THEN NULL ELSE c.id || '-level-' || (l.number - 1) END,
  l.display_order,
  1,
  1
FROM courses c
CROSS JOIN level_templates l
WHERE c.is_sample = 1;

INSERT OR IGNORE INTO level_contents
  (id, level_id, content_type, content_id, display_order, required)
SELECT
  l.id || '-question-' || printf('%02d', qn.n),
  l.id,
  'QUESTION',
  l.course_id || '-question-' || printf('%02d', qn.n),
  qn.n,
  1
FROM levels l
JOIN (
  WITH RECURSIVE numbers(n) AS (
    VALUES(1)
    UNION ALL
    SELECT n + 1 FROM numbers WHERE n < 15
  )
  SELECT n FROM numbers
) qn
  ON qn.n BETWEEN ((l.number - 1) * 5 + 1) AND (l.number * 5)
WHERE l.published = 1;

INSERT OR IGNORE INTO user_level_progress
  (id, user_id, course_id, level_id, status, best_score, attempt_count)
SELECT
  e.id || '-' || l.id,
  e.user_id,
  e.course_id,
  l.id,
  CASE WHEN l.required_level_id IS NULL THEN 'AVAILABLE' ELSE 'LOCKED' END,
  0,
  0
FROM user_course_enrollments e
JOIN levels l ON l.course_id = e.course_id
WHERE e.status IN ('ACTIVE', 'PAUSED');

-- Development review item due today.
INSERT OR IGNORE INTO review_schedules
  (id, user_id, course_id, target_type, target_id, next_review_at,
   interval_days, ease_factor, consecutive_correct, consecutive_wrong,
   review_count, status)
VALUES
  ('review-user1-isms-q01', 'user-learner-1', 'course-isms-p', 'QUESTION',
   'course-isms-p-question-01', CURRENT_TIMESTAMP, 0, 250, 0, 1, 1, 'DUE');

INSERT OR IGNORE INTO mock_exams
  (id, course_id, title, description, exam_type, question_count,
   time_limit_minutes, passing_score, max_attempts, randomize_questions,
   randomize_choices, status, published)
SELECT
  c.id || '-mock-quick',
  c.id,
  '[개발용 샘플] ' || c.short_name || ' 빠른 모의고사',
  '[개발용 샘플] 독립 제작 문제 10개로 구성된 빠른 점검 시험입니다.',
  'QUICK',
  10,
  15,
  60,
  3,
  1,
  0,
  'OPEN',
  1
FROM courses c
WHERE c.is_sample = 1;

INSERT OR IGNORE INTO mock_exam_sections
  (id, mock_exam_id, subject_id, title, question_count, score_weight, display_order)
SELECT
  m.id || '-section-1',
  m.id,
  NULL,
  '종합 영역',
  10,
  100,
  1
FROM mock_exams m
WHERE m.title LIKE '[개발용 샘플]%';

INSERT OR IGNORE INTO mock_exam_questions
  (mock_exam_id, question_id, section_id, score, display_order)
SELECT
  m.id,
  q.id,
  m.id || '-section-1',
  10,
  CAST(substr(q.id, -2) AS INTEGER)
FROM mock_exams m
JOIN questions q
  ON q.id LIKE m.course_id || '-question-%'
 AND CAST(substr(q.id, -2) AS INTEGER) BETWEEN 1 AND 10
WHERE m.title LIKE '[개발용 샘플]%';

INSERT OR IGNORE INTO user_learning_settings
  (id, user_id, daily_question_goal, daily_study_minutes)
SELECT
  'learning-settings-' || u.id,
  u.id,
  20,
  30
FROM users u;

-- Keep development E2E runs repeatable while production exams retain configurable limits.
UPDATE mock_exams
SET max_attempts = 100
WHERE id LIKE 'course-%-mock-quick';

-- Phase 4: DB-driven course specialization capabilities.
INSERT OR IGNORE INTO course_specializations
  (id, course_id, feature_type, display_name, description, configuration_json, display_order, active)
VALUES
  ('spec-isms-standard', 'course-isms-p', 'ISMS_STANDARD', 'ISMS-P 인증기준', '[개발용 샘플] 인증기준·증적·결함·심사 포인트 학습', '{"referenceDate":"2026-07-27"}', 1, 1),
  ('spec-isms-case', 'course-isms-p', 'ISMS_DEFECT_CASE', 'ISMS-P 결함사례', '[개발용 샘플] 상황 기반 결함 판단 연습', '{"referenceDate":"2026-07-27"}', 2, 1),
  ('spec-isms-law', 'course-isms-p', 'LEGAL_ARTICLE', '관련 법령', '[개발용 샘플] 기준과 연결된 법령 학습', '{"referenceDate":"2026-07-27"}', 3, 1),
  ('spec-cppg-law', 'course-cppg', 'LEGAL_ARTICLE', '개인정보 법령 학습', '[개발용 샘플] 조문·기간·비교 학습', '{"referenceDate":"2026-07-27"}', 1, 1),
  ('spec-ise-written', 'course-ise', 'WRITTEN_PRACTICE', '실기 서술형 보조채점', '[개발용 샘플] 키워드 기반 참고용 보조채점', '{"advisoryOnly":true,"referenceDate":"2026-07-27"}', 1, 1),
  ('spec-isie-written', 'course-isie', 'WRITTEN_PRACTICE', '기초 실무 연습', '[개발용 샘플] 산업기사 기초 실무 문제', '{"advisoryOnly":true,"referenceDate":"2026-07-27"}', 1, 1),
  ('spec-isrm-risk', 'course-isrm', 'RISK_SCENARIO', '위험 시나리오와 위험등록부', '[개발용 샘플] 자산·위협·취약점 매핑과 위험평가', '{"referenceDate":"2026-07-27"}', 1, 1);

-- Five shared security domains are stored separately for Engineer and Industrial Engineer.
WITH security_domains(code, name, display_order) AS (
  VALUES
    ('SYSTEM_SECURITY', '시스템 보안', 10),
    ('NETWORK_SECURITY', '네트워크 보안', 11),
    ('APPLICATION_SECURITY', '애플리케이션 보안', 12),
    ('SECURITY_FOUNDATION', '정보보안 일반', 13),
    ('SECURITY_LAW', '정보보안 관리 및 법규', 14)
)
INSERT OR IGNORE INTO subjects
  (id, course_id, code, name, description, display_order, active, is_sample)
SELECT
  c.id || '-subject-' || lower(d.code),
  c.id,
  d.code,
  c.short_name || ' · ' || d.name,
  '[개발용 샘플] 기사·산업기사 공통 분야를 과정별 진도와 난이도로 분리 관리합니다.',
  d.display_order,
  1,
  1
FROM courses c
CROSS JOIN security_domains d
WHERE c.id IN ('course-ise', 'course-isie');

INSERT OR IGNORE INTO topics
  (id, subject_id, parent_topic_id, code, name, description, display_order, active, is_sample)
SELECT
  s.id || '-topic-core',
  s.id,
  NULL,
  'CORE',
  s.name || ' 핵심 실무',
  '[개발용 샘플] 공통 분야별 독립 제작 학습 주제',
  1,
  1,
  1
FROM subjects s
WHERE s.course_id IN ('course-ise', 'course-isie')
  AND s.display_order BETWEEN 10 AND 14;

-- ISMS-P standards: independent development samples, not official text.
WITH RECURSIVE numbers(n) AS (
  VALUES(1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 20
)
INSERT OR IGNORE INTO isms_standards
  (id, code, title, major_category, middle_category, description, key_points,
   evidence_examples, defect_examples, audit_points, version, effective_date,
   source_url, active, is_sample)
SELECT
  'sample-isms-standard-' || printf('%02d', n),
  CASE WHEN n <= 7 THEN '1.' || n WHEN n <= 14 THEN '2.' || (n - 7) ELSE '3.' || (n - 14) END,
  '[개발용 샘플] 인증기준 학습 항목 ' || printf('%02d', n),
  CASE WHEN n <= 7 THEN '관리체계 수립 및 운영' WHEN n <= 14 THEN '보호대책 요구사항' ELSE '개인정보 처리단계별 요구사항' END,
  CASE WHEN n % 3 = 1 THEN '정책 및 조직' WHEN n % 3 = 2 THEN '위험 및 통제' ELSE '점검 및 개선' END,
  '[개발용 샘플] 조직의 범위와 책임, 실행 기록을 연결해 판단하는 연습용 설명입니다.',
  '책임자 지정 | 적용범위 명확화 | 정기 검토 | 변경이력 보존',
  '승인된 정책서 | 회의록 | 점검표 | 변경관리 기록',
  '책임 불명확 | 기록 미보존 | 점검주기 누락',
  '문서의 존재뿐 아니라 실제 수행기록과 표본의 일관성을 확인합니다.',
  'DEV-2026.1',
  '2026-07-27',
  NULL,
  1,
  1
FROM numbers;

WITH RECURSIVE numbers(n) AS (
  VALUES(1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 10
)
INSERT OR IGNORE INTO isms_defect_cases
  (id, title, situation, defect_description, related_standard_id, evidence,
   corrective_action, source, source_date, is_sample)
SELECT
  'sample-isms-defect-' || printf('%02d', n),
  '[개발용 샘플] 결함사례 ' || printf('%02d', n),
  '정기 점검표에는 완료로 표시되어 있으나 일부 시스템의 수행 로그가 남아 있지 않은 가상 상황입니다.',
  '통제 수행을 객관적으로 입증할 기록이 없어 운영의 유효성을 확인하기 어렵습니다.',
  'sample-isms-standard-' || printf('%02d', ((n - 1) % 20) + 1),
  '점검표, 시스템 로그, 승인 기록의 날짜와 대상 범위 비교',
  '대상 시스템 목록을 보완하고 수행 로그의 보존·검토 절차를 명확히 합니다.',
  '[개발용 독립 샘플] 내부 학습 시나리오',
  '2026-07-27',
  1
FROM numbers;

-- Legal learning samples and immutable version snapshots.
WITH RECURSIVE numbers(n) AS (
  VALUES(1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 20
)
INSERT OR IGNORE INTO legal_articles
  (id, law_name, article_number, article_title, content, effective_date,
   revision_date, source_url, version, active, is_sample)
SELECT
  'sample-legal-article-' || printf('%02d', n),
  CASE WHEN n <= 12 THEN '개인정보 보호법 학습 모형' ELSE '정보통신 보호기준 학습 모형' END,
  '제' || n || '조',
  '[개발용 샘플] 조문 학습 주제 ' || printf('%02d', n),
  '[개발용 요약 샘플] 실제 법령 원문이 아닙니다. 처리 목적, 최소 수집, 안전조치, 보유기간과 책임을 사례에 적용하는 연습용 문장입니다.',
  '2026-07-27',
  '2026-07-27',
  NULL,
  'DEV-2026.1',
  1,
  1
FROM numbers;

INSERT OR IGNORE INTO legal_article_versions
  (id, legal_article_id, version, content, effective_date, revision_date,
   change_summary, source_url, created_by)
SELECT
  id || '-version-DEV-2026-1',
  id,
  version,
  content,
  effective_date,
  revision_date,
  '[개발용 샘플] 최초 학습 버전',
  source_url,
  'user-admin'
FROM legal_articles
WHERE is_sample = 1;

INSERT OR IGNORE INTO risk_calculation_methods
  (id, name, description, formula_type, configuration_json, active, is_sample)
VALUES
  ('risk-method-multiply', '[개발용 샘플] 가능성×영향도', '가능성과 영향도를 곱하는 기본 정성평가 예시', 'MULTIPLY', '{"multiplier":1,"minimum":0,"maximum":25}', 1, 1),
  ('risk-method-weighted', '[개발용 샘플] 가중합 평가', '가능성보다 영향도에 높은 가중치를 적용하는 예시', 'WEIGHTED', '{"likelihoodWeight":1,"impactWeight":2,"minimum":0,"maximum":30}', 1, 1);

INSERT OR IGNORE INTO risk_grade_criteria
  (id, calculation_method_id, code, label, min_value, max_value, treatment_guidance, display_order)
VALUES
  ('risk-grade-m-low', 'risk-method-multiply', 'LOW', '낮음', 0, 6, '모니터링 또는 수용을 검토합니다.', 1),
  ('risk-grade-m-medium', 'risk-method-multiply', 'MEDIUM', '보통', 7, 14, '추가 통제의 비용과 효과를 검토합니다.', 2),
  ('risk-grade-m-high', 'risk-method-multiply', 'HIGH', '높음', 15, 25, '우선순위를 높여 저감 또는 회피를 검토합니다.', 3),
  ('risk-grade-w-low', 'risk-method-weighted', 'LOW', '낮음', 0, 8, '모니터링 또는 수용을 검토합니다.', 1),
  ('risk-grade-w-medium', 'risk-method-weighted', 'MEDIUM', '보통', 9, 18, '추가 통제를 계획합니다.', 2),
  ('risk-grade-w-high', 'risk-method-weighted', 'HIGH', '높음', 19, 30, '즉시 저감 또는 회피를 검토합니다.', 3);

WITH RECURSIVE numbers(n) AS (
  VALUES(1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 10
)
INSERT OR IGNORE INTO risk_scenarios
  (id, course_id, calculation_method_id, title, asset, threat, vulnerability,
   existing_controls, likelihood, impact, risk_value, risk_level,
   treatment_option, residual_risk, description, reference_date, is_sample)
SELECT
  'sample-risk-scenario-' || printf('%02d', n),
  'course-isrm',
  CASE WHEN n % 2 = 0 THEN 'risk-method-weighted' ELSE 'risk-method-multiply' END,
  '[개발용 샘플] 위험 시나리오 ' || printf('%02d', n),
  CASE WHEN n % 3 = 0 THEN '고객정보 처리 시스템' WHEN n % 3 = 1 THEN '업무용 단말' ELSE '외부 연계 API' END,
  CASE WHEN n % 2 = 0 THEN '계정 탈취 시도' ELSE '서비스 가용성 저해' END,
  '점검 주기와 접근통제 설정이 자산 중요도에 맞게 조정되지 않은 가상 취약점',
  '기본 접근통제, 로그 수집, 주기적 백업',
  ((n - 1) % 5) + 1,
  ((n + 1) % 5) + 1,
  (((n - 1) % 5) + 1) * (((n + 1) % 5) + 1),
  CASE WHEN ((((n - 1) % 5) + 1) * (((n + 1) % 5) + 1)) >= 15 THEN 'HIGH' WHEN ((((n - 1) % 5) + 1) * (((n + 1) % 5) + 1)) >= 7 THEN 'MEDIUM' ELSE 'LOW' END,
  CASE WHEN n % 3 = 0 THEN '회피' WHEN n % 3 = 1 THEN '저감' ELSE '수용' END,
  n % 6,
  '[개발용 독립 샘플] 자산·위협·취약점과 기존 통제를 연결하는 연습용 시나리오입니다.',
  '2026-07-27',
  1
FROM numbers;

-- Generic links allow one standard, law or scenario to be reused by many courses.
INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-isms-' || id, 'ISMS_STANDARD', id, 'course-isms-p', 'PRIMARY', CAST(substr(id, -2) AS INTEGER)
FROM isms_standards WHERE is_sample = 1;

INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-defect-' || id, 'ISMS_DEFECT_CASE', id, 'course-isms-p', 'CASE', CAST(substr(id, -2) AS INTEGER)
FROM isms_defect_cases WHERE is_sample = 1;

INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-cppg-' || id, 'LEGAL_ARTICLE', id, 'course-cppg', 'PRIMARY', CAST(substr(id, -2) AS INTEGER)
FROM legal_articles WHERE is_sample = 1;

INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
VALUES
  ('link-shared-law-isms', 'LEGAL_ARTICLE', 'sample-legal-article-01', 'course-isms-p', 'RELATED', 1),
  ('link-shared-law-pia', 'LEGAL_ARTICLE', 'sample-legal-article-01', 'course-pia', 'RELATED', 1),
  ('link-shared-law-ise', 'LEGAL_ARTICLE', 'sample-legal-article-01', 'course-ise', 'RELATED', 1);

INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-risk-' || id, 'RISK_SCENARIO', id, 'course-isrm', 'PRIMARY', CAST(substr(id, -2) AS INTEGER)
FROM risk_scenarios WHERE is_sample = 1;

-- 100 independent development questions across the five specialized courses.
WITH RECURSIVE numbers(n) AS (
  VALUES(1)
  UNION ALL SELECT n + 1 FROM numbers WHERE n < 25
),
plans(course_id, prefix, max_no) AS (
  VALUES
    ('course-isms-p', 'spec-isms', 20),
    ('course-cppg', 'spec-cppg', 20),
    ('course-ise', 'spec-ise', 25),
    ('course-isie', 'spec-isie', 20),
    ('course-isrm', 'spec-isrm', 15)
)
INSERT OR IGNORE INTO questions
  (id, title, content, type, difficulty, explanation, wrong_answer_explanation,
   answer_config_json, status, source, source_date, version, created_by,
   reviewed_by, published_at, is_sample)
SELECT
  p.prefix || '-question-' || printf('%02d', n),
  '[개발용 샘플] ' ||
    CASE
      WHEN p.course_id = 'course-ise' AND n = 21 THEN '로그 분석 '
      WHEN p.course_id = 'course-ise' AND n = 22 THEN '보안 명령어 작성 '
      WHEN p.course_id = 'course-ise' AND n = 23 THEN '네트워크 설정 분석 '
      WHEN p.course_id = 'course-ise' AND n = 24 THEN '코드 취약점 분석 '
      WHEN p.course_id = 'course-ise' AND n = 25 THEN '보안 설정 분석 '
      ELSE CASE p.course_id
      WHEN 'course-isms-p' THEN '인증범위·기준·결함·증적 판단 '
      WHEN 'course-cppg' THEN '법령·기간·처리단계 판단 '
      WHEN 'course-ise' THEN '정보보안기사 이론·실무 '
      WHEN 'course-isie' THEN '정보보안산업기사 기초 실무 '
      ELSE 'ISRM 위험평가 '
      END
    END || printf('%02d', n),
  '[개발용 독립 샘플] 실제 기출문제나 유료 교재 문항이 아닙니다. 가상의 조직 상황에서 가장 적절한 통제 또는 판단을 선택하거나 설명하세요.',
  CASE
    WHEN p.course_id = 'course-ise' AND n BETWEEN 11 AND 15 THEN 'SHORT_ANSWER'
    WHEN p.course_id = 'course-ise' AND n BETWEEN 16 AND 20 THEN 'ESSAY'
    WHEN p.course_id = 'course-ise' AND n IN (21, 22, 23) THEN 'LOG_ANALYSIS'
    WHEN p.course_id = 'course-ise' AND n IN (24, 25) THEN 'CODE_ANALYSIS'
    WHEN p.course_id = 'course-isie' AND n BETWEEN 16 AND 20 THEN 'SHORT_ANSWER'
    ELSE 'SINGLE_CHOICE'
  END,
  CASE
    WHEN p.course_id = 'course-isie' THEN CASE WHEN n <= 10 THEN 'EASY' ELSE 'MEDIUM' END
    WHEN p.course_id = 'course-ise' AND n > 15 THEN 'HARD'
    WHEN n % 3 = 0 THEN 'HARD'
    WHEN n % 3 = 1 THEN 'EASY'
    ELSE 'MEDIUM'
  END,
  '[개발용 샘플 해설] 목적, 범위, 책임, 기록과 위험을 함께 검토해야 합니다.',
  '[개발용 샘플 오답 해설] 단일 문서의 존재나 관행만으로 결론을 내리지 않습니다.',
  CASE
    WHEN (p.course_id = 'course-ise' AND n BETWEEN 11 AND 15)
      OR (p.course_id = 'course-isie' AND n BETWEEN 16 AND 20)
    THEN '{"acceptedAnswers":["최소 권한"],"synonyms":["least privilege"],"ignoreCase":true,"normalizeWhitespace":true}'
    ELSE '{}'
  END,
  'PUBLISHED',
  '[개발용 독립 샘플] Shield Academy 제작',
  '2026-07-27',
  1,
  'user-admin',
  'user-super-admin',
  CURRENT_TIMESTAMP,
  1
FROM plans p
JOIN numbers ON n <= p.max_no;

INSERT OR IGNORE INTO question_choices
  (id, question_id, content, display_order, is_correct, explanation)
SELECT
  q.id || '-choice-' || choice_no,
  q.id,
  CASE choice_no
    WHEN 1 THEN '목적과 범위를 확인하고 책임·기록·위험을 함께 검토한다'
    WHEN 2 THEN '담당자의 구두 설명만으로 충족 여부를 확정한다'
    WHEN 3 THEN '표본 확인 없이 문서 제목만 확인한다'
    ELSE '변경 가능성을 고려하지 않고 과거 결과를 그대로 사용한다'
  END,
  choice_no,
  CASE WHEN choice_no = 1 THEN 1 ELSE 0 END,
  CASE WHEN choice_no = 1 THEN '[개발용 샘플] 근거와 실제 운영을 함께 확인하는 선택입니다.' ELSE '[개발용 샘플] 충분한 근거가 없는 선택입니다.' END
FROM questions q
JOIN (SELECT 1 AS choice_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4)
WHERE q.id LIKE 'spec-%'
  AND q.type = 'SINGLE_CHOICE';

INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
SELECT
  id,
  CASE
    WHEN id LIKE 'spec-isms-%' THEN 'course-isms-p'
    WHEN id LIKE 'spec-cppg-%' THEN 'course-cppg'
    WHEN id LIKE 'spec-ise-%' THEN 'course-ise'
    WHEN id LIKE 'spec-isie-%' THEN 'course-isie'
    ELSE 'course-isrm'
  END,
  100
FROM questions
WHERE id LIKE 'spec-%';

INSERT OR IGNORE INTO question_subjects (question_id, subject_id)
SELECT
  q.id,
  CASE
    WHEN qc.course_id IN ('course-ise', 'course-isie')
    THEN qc.course_id || '-subject-' ||
      CASE ((CAST(substr(q.id, -2) AS INTEGER) - 1) % 5)
        WHEN 0 THEN 'system_security'
        WHEN 1 THEN 'network_security'
        WHEN 2 THEN 'application_security'
        WHEN 3 THEN 'security_foundation'
        ELSE 'security_law'
      END
    ELSE qc.course_id || '-subject-foundation'
  END
FROM questions q
JOIN question_courses qc ON q.id = qc.question_id
WHERE q.id LIKE 'spec-%';

INSERT OR IGNORE INTO question_topics (question_id, topic_id)
SELECT qs.question_id, t.id
FROM question_subjects qs
JOIN topics t ON t.subject_id = qs.subject_id
WHERE qs.question_id LIKE 'spec-%'
  AND t.display_order = 1;

INSERT OR IGNORE INTO question_versions
  (id, question_id, version, snapshot_json, review_comment, created_by)
SELECT
  id || '-version-01',
  id,
  1,
  json_object('id', id, 'title', title, 'type', type, 'sample', 1, 'referenceDate', source_date),
  '[개발용 샘플] 독립 제작 및 검수 완료',
  'user-admin'
FROM questions
WHERE id LIKE 'spec-%';

INSERT OR IGNORE INTO written_answer_rules
  (question_id, model_answer, required_keywords_json, optional_keywords_json,
   maximum_score, partial_score_rules_json, guidance, reference_date)
SELECT
  id,
  '[개발용 모범답안] 자산과 위협을 식별하고 최소 권한, 로그 검토, 변경관리 통제를 위험에 맞게 적용하며 수행 증적을 보존한다.',
  '["자산","위협","최소 권한"]',
  '["로그","변경관리","증적"]',
  100,
  '[{"keywords":["위험","통제"],"score":10,"mode":"ALL"}]',
  '키워드 기반 학습 보조채점이며 공식 시험 채점 결과가 아닙니다.',
  '2026-07-27'
FROM questions
WHERE id LIKE 'spec-ise-question-%'
  AND type = 'ESSAY';

INSERT OR IGNORE INTO content_question_links
  (id, content_type, content_id, question_id, relation_type)
SELECT
  'cq-standard-' || printf('%02d', n),
  'ISMS_STANDARD',
  'sample-isms-standard-' || printf('%02d', n),
  'spec-isms-question-' || printf('%02d', n),
  'PRACTICE'
FROM (
  WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 20)
  SELECT n FROM nums
);

INSERT OR IGNORE INTO course_specializations
  (id, course_id, feature_type, display_name, description, configuration_json, display_order, active)
VALUES
  ('spec-cppg-memory', 'course-cppg', 'LEGAL_MEMORY', '숫자·기간 암기', '[개발용 샘플] 시행일·개정일과 기간형 핵심값을 비교합니다.', '{"referenceDate":"2026-07-27"}', 2, 1),
  ('spec-cppg-compare', 'course-cppg', 'LEGAL_COMPARE', '유사 조문 비교', '[개발용 샘플] 위탁·제3자 제공·동의 요건을 비교합니다.', '{"referenceDate":"2026-07-27"}', 3, 1),
  ('spec-cppg-lifecycle', 'course-cppg', 'PRIVACY_LIFECYCLE', '개인정보 생명주기', '[개발용 샘플] 수집·이용·제공·보관·파기 단계를 연결합니다.', '{"referenceDate":"2026-07-27"}', 4, 1);

INSERT OR IGNORE INTO user_course_enrollments
  (id, user_id, course_id, status, current_level, progress_percent, total_xp)
VALUES
  ('enrollment-user1-isrm', 'user-learner-1', 'course-isrm', 'ACTIVE', 1, 0, 0),
  ('enrollment-user2-isie', 'user-learner-2', 'course-isie', 'ACTIVE', 1, 0, 0);

INSERT OR IGNORE INTO user_level_progress
  (id, user_id, course_id, level_id, status, best_score, attempt_count)
SELECT
  e.id || '-' || l.id,
  e.user_id,
  e.course_id,
  l.id,
  CASE WHEN l.required_level_id IS NULL THEN 'AVAILABLE' ELSE 'LOCKED' END,
  0,
  0
FROM user_course_enrollments e
JOIN levels l ON l.course_id = e.course_id
WHERE e.id IN ('enrollment-user1-isrm', 'enrollment-user2-isie');

UPDATE questions SET title = '[개발용 샘플] 로그 분석 21' WHERE id = 'spec-ise-question-21';
UPDATE questions SET title = '[개발용 샘플] 보안 명령어 작성 22' WHERE id = 'spec-ise-question-22';
UPDATE questions SET title = '[개발용 샘플] 네트워크 설정 분석 23' WHERE id = 'spec-ise-question-23';
UPDATE questions SET title = '[개발용 샘플] 코드 취약점 분석 24' WHERE id = 'spec-ise-question-24';
UPDATE questions SET title = '[개발용 샘플] 보안 설정 분석 25' WHERE id = 'spec-ise-question-25';

INSERT OR IGNORE INTO content_question_links
  (id, content_type, content_id, question_id, relation_type)
SELECT
  'cq-law-' || printf('%02d', n),
  'LEGAL_ARTICLE',
  'sample-legal-article-' || printf('%02d', n),
  'spec-cppg-question-' || printf('%02d', n),
  'PRACTICE'
FROM (
  WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 20)
  SELECT n FROM nums
);

INSERT OR IGNORE INTO content_question_links
  (id, content_type, content_id, question_id, relation_type)
SELECT
  'cq-risk-' || printf('%02d', n),
  'RISK_SCENARIO',
  'sample-risk-scenario-' || printf('%02d', ((n - 1) % 10) + 1),
  'spec-isrm-question-' || printf('%02d', n),
  'PRACTICE'
FROM (
  WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 15)
  SELECT n FROM nums
);

-- Phase 5 practical specializations: independently authored development samples.
INSERT OR IGNORE INTO course_specializations
  (id, course_id, feature_type, display_name, description, configuration_json, display_order, active)
VALUES
  ('specialization-sw-code', 'course-sw-vuln', 'SECURE_CODE_ANALYSIS', '보안약점 코드 분석', '[개발용 샘플] 줄 선택·CWE·정탐/오탐·조치방안 연습', '{"execution":"disabled","languages":["Java","C","C++"]}', 1, 1),
  ('specialization-pia-flow', 'course-pia', 'PRIVACY_IMPACT_ASSESSMENT', '개인정보 영향평가 실무', '[개발용 샘플] 대상 판단·처리 흐름·평가항목·개선방안 연습', '{"tracks":["EXAM_PREP","PRACTICE"]}', 1, 1);

INSERT OR IGNORE INTO user_course_enrollments
  (id, user_id, course_id, status, current_level, progress_percent, total_xp)
VALUES
  ('enrollment-user1-sw-vuln', 'user-learner-1', 'course-sw-vuln', 'ACTIVE', 1, 0, 0),
  ('enrollment-user1-pia', 'user-learner-1', 'course-pia', 'ACTIVE', 1, 0, 0),
  ('enrollment-user2-pia', 'user-learner-2', 'course-pia', 'ACTIVE', 1, 0, 0);

INSERT OR IGNORE INTO secure_coding_weaknesses
  (id, code, name, category, description, language, cwe_code, risk,
   detection_guide, remediation_guide, reference, version, active, is_sample)
VALUES
  ('weak-sql-injection', 'SQL_INJECTION', 'SQL 삽입', '입력 데이터 검증', '[개발용 샘플] 외부 입력이 SQL 구조에 결합되는 위험', 'COMMON', 'CWE-89', 'CRITICAL', '문자열 연결로 쿼리를 만드는 지점을 추적한다.', '매개변수화 쿼리와 허용 목록 검증을 사용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-command-injection', 'COMMAND_INJECTION', '명령어 삽입', '입력 데이터 검증', '[개발용 샘플] 외부 입력이 운영체제 명령에 전달되는 위험', 'COMMON', 'CWE-78', 'CRITICAL', '프로세스 생성 API까지의 데이터 흐름을 확인한다.', '명령 실행을 제거하고 고정 인자 API를 사용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-path-traversal', 'PATH_TRAVERSAL', '경로 조작', '파일 및 자원', '[개발용 샘플] 신뢰할 수 없는 경로가 기준 디렉터리를 벗어나는 위험', 'COMMON', 'CWE-22', 'HIGH', '경로 정규화 전후와 기준 디렉터리 검사를 확인한다.', '정규화 후 허용된 루트 내부인지 검증한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-hardcoded-password', 'HARDCODED_PASSWORD', '하드코딩된 비밀번호', '보안 기능', '[개발용 샘플] 소스에 인증 비밀이 포함되는 위험', 'COMMON', 'CWE-798', 'HIGH', '문자열 상수와 설정 기본값에서 비밀 패턴을 찾는다.', '비밀 저장소와 환경 기반 주입을 사용하고 교체한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-resource-release', 'RESOURCE_RELEASE', '부적절한 자원 해제', '오류 및 자원 관리', '[개발용 샘플] 예외 경로에서 파일·메모리가 해제되지 않는 위험', 'COMMON', 'CWE-772', 'MEDIUM', '모든 반환·예외 경로에서 해제 여부를 확인한다.', '자동 자원 관리 또는 단일 정리 구문을 사용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-null-pointer', 'NULL_POINTER', 'Null Pointer 역참조', '오류 및 자원 관리', '[개발용 샘플] null 가능 값을 확인 없이 사용하는 위험', 'COMMON', 'CWE-476', 'MEDIUM', 'null 가능 반환값의 호출 흐름을 확인한다.', '사용 전 null 검증과 실패 처리를 추가한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-race-condition', 'RACE_CONDITION', '경쟁조건', '동시성', '[개발용 샘플] 공유 상태 확인과 사용 사이에 상태가 바뀌는 위험', 'COMMON', 'CWE-362', 'HIGH', '공유 상태 접근과 잠금 범위를 분석한다.', '원자 연산 또는 일관된 잠금 범위를 사용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-response-splitting', 'HTTP_RESPONSE_SPLITTING', 'HTTP 응답분할', '웹 출력', '[개발용 샘플] 개행이 응답 헤더에 들어가는 위험', 'Java', 'CWE-113', 'HIGH', '헤더 API에 전달되는 외부 입력을 추적한다.', 'CR/LF를 거부하고 안전한 헤더 API를 사용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-error-exposure', 'ERROR_INFO_EXPOSURE', '오류정보 노출', '오류 처리', '[개발용 샘플] 내부 경로와 스택이 사용자에게 노출되는 위험', 'COMMON', 'CWE-209', 'MEDIUM', '예외 메시지가 응답에 직접 포함되는지 확인한다.', '사용자용 일반 오류와 내부 제한 로그를 분리한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1),
  ('weak-weak-crypto', 'WEAK_CRYPTO', '취약한 암호화 사용', '암호화', '[개발용 샘플] 안전하지 않은 알고리즘이나 모드를 사용하는 위험', 'COMMON', 'CWE-327', 'HIGH', '알고리즘과 모드, 키 생성 방식을 확인한다.', '검증된 현대 알고리즘과 안전한 키 관리를 적용한다.', '독립 작성 개발용 샘플', 'DEV-2026.1', 1, 1);

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 30)
INSERT OR IGNORE INTO questions
  (id, title, content, type, difficulty, explanation, wrong_answer_explanation,
   status, source, source_date, version, answer_config_json, is_sample,
   created_by, reviewed_by, published_at)
SELECT
  'practical-code-question-' || printf('%02d', n),
  '[개발용 샘플] 코드 보안약점 진단 ' || printf('%02d', n),
  '[개발용 샘플] 표시된 코드를 분석하여 취약 라인, 약점 유형, CWE와 조치방안을 제출하세요.',
  'CODE_ANALYSIS',
  CASE WHEN n % 3 = 0 THEN 'HARD' WHEN n % 3 = 1 THEN 'EASY' ELSE 'MEDIUM' END,
  '독립 작성한 정적 코드 분석 학습 샘플입니다.',
  '취약 라인과 데이터 흐름을 다시 확인하세요.',
  'PUBLISHED',
  'INDEPENDENT_DEVELOPMENT_SAMPLE',
  '2026-07-27',
  1,
  '{"autoGrade":"specialized-code-analysis"}',
  1,
  'user-admin',
  'user-super-admin',
  CURRENT_TIMESTAMP
FROM nums;

-- 공통 콘텐츠 버전 이력. 기존 콘텐츠 ID와 학습 기록은 그대로 유지한다.
INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-legal-' || id, 'LEGAL_ARTICLE', id,
       (SELECT course_id FROM content_course_links l
        WHERE l.content_type = 'LEGAL_ARTICLE' AND l.content_id = legal_articles.id LIMIT 1),
       law_name || ' ' || article_number || ' ' || article_title,
       effective_date, version, 'published',
       json_object('lawName', law_name, 'articleNumber', article_number,
         'articleTitle', article_title, 'content', content,
         'effectiveDate', effective_date, 'revisionDate', revision_date,
         'sourceUrl', source_url, 'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 법령 기준선', 1, 'user-super-admin'
FROM legal_articles;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-isms-' || id, 'ISMS_STANDARD', id,
       (SELECT course_id FROM content_course_links l
        WHERE l.content_type = 'ISMS_STANDARD' AND l.content_id = isms_standards.id LIMIT 1),
       code || ' ' || title, effective_date, version, 'published',
       json_object('code', code, 'title', title, 'majorCategory', major_category,
         'middleCategory', middle_category, 'description', description,
         'keyPoints', key_points, 'evidenceExamples', evidence_examples,
         'defectExamples', defect_examples, 'auditPoints', audit_points,
         'effectiveDate', effective_date, 'sourceUrl', source_url, 'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 인증기준 기준선', 1, 'user-super-admin'
FROM isms_standards;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-pia-item-' || id, 'PRIVACY_IMPACT_ITEM', id,
       (SELECT course_id FROM course_specializations
        WHERE feature_type = 'PRIVACY_IMPACT_ASSESSMENT' AND active = 1 LIMIT 1),
       code || ' ' || title, effective_date, version, 'published',
       json_object('code', code, 'category', category, 'title', title,
         'description', description, 'checkPoints', check_points,
         'evidenceExamples', evidence_examples, 'riskExamples', risk_examples,
         'improvementExamples', improvement_examples,
         'effectiveDate', effective_date, 'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 영향평가 항목 기준선', 1, 'user-super-admin'
FROM privacy_impact_assessment_items;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-subject-' || id, 'SUBJECT', id, course_id, name,
       substr(updated_at, 1, 10), '1', 'published',
       json_object('code', code, 'name', name, 'description', description,
         'displayOrder', display_order, 'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 시험과목 기준선', 1, 'user-super-admin'
FROM subjects;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-weakness-' || id, 'SECURE_CODING_WEAKNESS', id, NULL,
       code || ' ' || name, substr(updated_at, 1, 10), version, 'published',
       json_object('code', code, 'name', name, 'category', category,
         'description', description, 'language', language, 'cweCode', cwe_code,
         'risk', risk, 'detectionGuide', detection_guide,
         'remediationGuide', remediation_guide, 'reference', reference,
         'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 보안약점 기준선', 1, 'user-super-admin'
FROM secure_coding_weaknesses;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-unit-' || id, 'LEARNING_UNIT', id, course_id, title,
       substr(updated_at, 1, 10), '1', 'published',
       json_object('title', title, 'description', description,
         'displayOrder', display_order, 'active', active, 'published', published,
         'completionPolicy', completion_policy,
         'minimumProgressPercent', minimum_progress_percent,
         'minimumStudySeconds', minimum_study_seconds),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 학습단위 기준선', 1, 'user-super-admin'
FROM learning_units;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-lesson-' || id, 'LESSON', id, course_id, title,
       substr(updated_at, 1, 10), cast(version AS text), 'published',
       json_object('title', title, 'summary', summary, 'content', content,
         'contentFormat', content_format, 'estimatedMinutes', estimated_minutes,
         'displayOrder', display_order, 'active', active, 'published', published),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 이론 레슨 기준선', 1, 'user-super-admin'
FROM lessons;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-question-' || q.id, 'QUESTION_EXPLANATION', q.id,
       (SELECT course_id FROM question_courses qc WHERE qc.question_id = q.id LIMIT 1),
       q.title, coalesce(q.source_date, substr(q.updated_at, 1, 10)),
       cast(q.version AS text), 'published',
       json_object('title', q.title, 'explanation', q.explanation,
         'wrongAnswerExplanation', q.wrong_answer_explanation,
         'source', q.source, 'sourceDate', q.source_date),
       coalesce(q.published_at, q.updated_at), 'user-super-admin',
       coalesce(q.published_at, q.updated_at),
       '[개발용 Seed] 기존 문제 해설 기준선', 1, 'user-super-admin'
FROM questions q WHERE q.status = 'PUBLISHED';

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-audio-' || a.id, 'AUDIO_CONTENT', a.id, l.course_id, a.title,
       substr(a.updated_at, 1, 10), '1', 'published',
       json_object('title', a.title, 'audioUrl', a.audio_url,
         'transcript', a.transcript,
         'transcriptSegmentsJson', a.transcript_segments_json,
         'durationSeconds', a.duration_seconds,
         'voiceProvider', a.voice_provider, 'voiceName', a.voice_name,
         'speedOptionsJson', a.speed_options_json, 'published', a.published),
       a.updated_at, 'user-super-admin', a.updated_at,
       '[개발용 Seed] 기존 오디오 기준선', 1, 'user-super-admin'
FROM audio_contents a JOIN lessons l ON l.id = a.lesson_id;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-lecture-' || id, 'LECTURE', id, course_id, title,
       substr(updated_at, 1, 10), '1', 'published',
       json_object('title', title, 'instructorName', instructor_name,
         'description', description, 'videoProvider', video_provider,
         'videoUrl', video_url, 'thumbnailUrl', thumbnail_url,
         'durationSeconds', duration_seconds, 'free', free,
         'published', published, 'displayOrder', display_order),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 강의 기준선', 1, 'user-super-admin'
FROM lectures WHERE published = 1;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 30)
INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
SELECT 'practical-code-question-' || printf('%02d', n), 'course-sw-vuln', 100 FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 30)
INSERT OR IGNORE INTO secure_code_samples
  (id, weakness_id, question_id, language, title, vulnerable_code, secure_code,
   vulnerable_lines_json, explanation, false_positive_possible,
   expected_true_positive, call_relation, execution_flow,
   remediation_keywords_json, source_date, sample_only, active)
SELECT
  'secure-code-sample-' || printf('%02d', n),
  CASE ((n - 1) % 10)
    WHEN 0 THEN 'weak-sql-injection' WHEN 1 THEN 'weak-command-injection'
    WHEN 2 THEN 'weak-path-traversal' WHEN 3 THEN 'weak-hardcoded-password'
    WHEN 4 THEN 'weak-resource-release' WHEN 5 THEN 'weak-null-pointer'
    WHEN 6 THEN 'weak-race-condition' WHEN 7 THEN 'weak-response-splitting'
    WHEN 8 THEN 'weak-error-exposure' ELSE 'weak-weak-crypto' END,
  'practical-code-question-' || printf('%02d', n),
  CASE WHEN n <= 20 THEN 'Java' WHEN n % 2 = 0 THEN 'C' ELSE 'C++' END,
  '[개발용 샘플] ' || CASE WHEN n <= 20 THEN 'Java' WHEN n % 2 = 0 THEN 'C' ELSE 'C++' END || ' 코드 진단 ' || printf('%02d', n),
  CASE WHEN n <= 20
    THEN 'public String process(String input) {' || char(10) ||
         '  String value = input;' || char(10) ||
         '  return service.handle(value);' || char(10) || '}'
    ELSE 'int process(const char *input) {' || char(10) ||
         '  char buffer[64];' || char(10) ||
         '  return handle(input, buffer);' || char(10) || '}' END,
  CASE WHEN n <= 20
    THEN 'public String process(String input) {' || char(10) ||
         '  String value = validator.allowListed(input);' || char(10) ||
         '  return service.handle(value);' || char(10) || '}'
    ELSE 'int process(const char *input) {' || char(10) ||
         '  if (input == NULL) return ERROR;' || char(10) ||
         '  return handleValidated(input);' || char(10) || '}' END,
  CASE WHEN n <= 5 THEN '[]' ELSE '[2,3]' END,
  '[개발용 샘플] 입력에서 민감 API까지의 흐름과 방어 조건을 함께 확인한다.',
  CASE WHEN n <= 10 THEN 1 ELSE 0 END,
  CASE WHEN n <= 5 THEN 0 ELSE 1 END,
  '화면 입력 → 컨트롤러 → 서비스 → 민감 API 호출',
  '입력 수신 → 검증 여부 확인 → 처리 또는 안전한 거부',
  '["검증","허용 목록","안전한 API"]',
  '2026-07-27',
  1,
  1
FROM nums;

UPDATE secure_code_samples
SET vulnerable_code = 'public String process(String input) {' || char(10) ||
  '  String marker = "<script>alert(''sample'')</script>";' || char(10) ||
  '  return service.handle(input);' || char(10) || '}'
WHERE id = 'secure-code-sample-01';

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 30)
INSERT OR IGNORE INTO secure_code_grading_rules
  (id, sample_id, line_score, weakness_score, cwe_score, judgment_score,
   keyword_score, remediation_code_score, maximum_score)
SELECT 'secure-code-rule-' || printf('%02d', n),
       'secure-code-sample-' || printf('%02d', n), 30, 20, 15, 15, 15, 5, 100
FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 30)
INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-secure-code-' || printf('%02d', n), 'SECURE_CODE_SAMPLE',
       'secure-code-sample-' || printf('%02d', n), 'course-sw-vuln', 'PRACTICE', n
FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 15)
INSERT OR IGNORE INTO privacy_impact_assessment_items
  (id, code, category, title, description, check_points, evidence_examples,
   risk_examples, improvement_examples, version, effective_date, active, is_sample)
SELECT
  'privacy-item-' || printf('%02d', n),
  'PIA_DEV_' || printf('%02d', n),
  CASE WHEN n <= 5 THEN '개인정보 수집' WHEN n <= 10 THEN '이용·제공' ELSE '보관·파기' END,
  '[개발용 샘플] 영향평가 확인항목 ' || printf('%02d', n),
  '독립 작성한 영향평가 연습용 항목입니다.',
  '처리 목적, 최소 수집, 접근권한, 전송 및 보유기간의 적정성을 확인한다.',
  '처리흐름도, 권한표, 접속기록, 파기정책 등 개발용 증적 예시',
  '과다 수집, 권한 과다, 암호화 누락, 보유기간 초과 등 개발용 침해요인',
  '최소 수집, 권한 분리, 암호화, 점검 주기와 책임자를 명시한다.',
  'DEV-2026.1',
  '2026-07-27',
  1,
  1
FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 15)
INSERT OR IGNORE INTO privacy_assessment_scenarios
  (id, course_id, title, description, organization_type, system_type,
   processed_data, data_subjects, processing_purpose, track,
   correct_target_decision, expected_assessment_items_json,
   model_improvement_plan, scoring_rules_json, sample_only, active)
SELECT
  'privacy-scenario-' || printf('%02d', n),
  'course-pia',
  CASE WHEN n <= 10 THEN '[개발용 샘플] 영향평가 대상 판단 ' ELSE '[개발용 샘플] 개인정보 흐름 분석 ' END || printf('%02d', n),
  '가상의 기관과 시스템을 대상으로 처리 흐름, 침해요인과 개선방안을 분석한다.',
  CASE WHEN n % 2 = 0 THEN '공공기관형 가상 조직' ELSE '민간 서비스형 가상 조직' END,
  CASE WHEN n <= 10 THEN '신규 업무 시스템' ELSE '대국민 통합 서비스' END,
  '성명, 연락처, 식별정보, 이용기록, 민감정보 일부',
  '서비스 신청자와 담당 직원',
  '서비스 제공, 민원 처리와 이용 현황 분석',
  CASE WHEN n % 2 = 0 THEN 'EXAM_PREP' ELSE 'PRACTICE' END,
  CASE WHEN n % 3 = 0 THEN 'REVIEW_NEEDED' WHEN n % 3 = 1 THEN 'REQUIRED' ELSE 'NOT_REQUIRED' END,
  '["privacy-item-01","privacy-item-02","privacy-item-03"]',
  '처리 목적에 필요한 최소 항목만 수집하고 접근권한을 역할별로 분리하며 전송·저장 구간을 암호화하고 보유기간 종료 시 안전하게 파기한다.',
  '{"riskKeywords":["과다 수집","접근권한","암호화"],"improvementKeywords":["최소 수집","권한 분리","암호화"],"decisionScore":30,"itemScore":30,"riskScore":20,"improvementScore":20}',
  1,
  1
FROM nums;

WITH flow_scenarios(n) AS (VALUES(11),(12),(13),(14),(15)),
node_templates(suffix, node_type, title, x, y, ord) AS (
  VALUES ('subject','DATA_SUBJECT','정보주체',40,100,1),
         ('collect','COLLECTION','수집 채널',280,100,2),
         ('store','STORAGE','업무 시스템',520,100,3),
         ('external','EXTERNAL','외부 처리자',760,100,4)
)
INSERT OR IGNORE INTO privacy_flow_nodes
  (id, scenario_id, node_type, title, description, system_name,
   organization_name, display_x, display_y, display_order)
SELECT
  'privacy-node-' || printf('%02d', f.n) || '-' || t.suffix,
  'privacy-scenario-' || printf('%02d', f.n),
  t.node_type,
  t.title,
  '[개발용 샘플] ' || t.title || ' 단계의 처리 목적과 보호조치를 확인한다.',
  CASE WHEN t.node_type IN ('COLLECTION','STORAGE') THEN t.title || ' 시스템' ELSE '' END,
  CASE WHEN t.node_type IN ('DATA_SUBJECT','EXTERNAL') THEN t.title || ' 조직' ELSE '' END,
  t.x, t.y, t.ord
FROM flow_scenarios f CROSS JOIN node_templates t;

WITH flow_scenarios(n) AS (VALUES(11),(12),(13),(14),(15))
INSERT OR IGNORE INTO privacy_flow_edges
  (id, scenario_id, source_node_id, target_node_id, data_types,
   transfer_method, purpose, protection_measures)
SELECT 'privacy-edge-' || printf('%02d', n) || '-1',
       'privacy-scenario-' || printf('%02d', n),
       'privacy-node-' || printf('%02d', n) || '-subject',
       'privacy-node-' || printf('%02d', n) || '-collect',
       '신청정보·연락처', '암호화 통신', '서비스 신청', '전송구간 암호화와 입력 검증'
FROM flow_scenarios
UNION ALL
SELECT 'privacy-edge-' || printf('%02d', n) || '-2',
       'privacy-scenario-' || printf('%02d', n),
       'privacy-node-' || printf('%02d', n) || '-collect',
       'privacy-node-' || printf('%02d', n) || '-store',
       '신청정보·이용기록', '내부 API', '업무 처리', '서비스 인증과 최소권한'
FROM flow_scenarios
UNION ALL
SELECT 'privacy-edge-' || printf('%02d', n) || '-3',
       'privacy-scenario-' || printf('%02d', n),
       'privacy-node-' || printf('%02d', n) || '-store',
       'privacy-node-' || printf('%02d', n) || '-external',
       '업무처리 최소정보', '외부 전송', '위탁 업무', '전송 암호화·수탁자 접근통제'
FROM flow_scenarios;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 25)
INSERT OR IGNORE INTO questions
  (id, title, content, type, difficulty, explanation, wrong_answer_explanation,
   status, source, source_date, version, answer_config_json, is_sample,
   created_by, reviewed_by, published_at)
SELECT
  'practical-pia-question-' || printf('%02d', n),
  CASE WHEN n <= 15 THEN '[개발용 샘플] 침해요인 분석 ' ELSE '[개발용 샘플] 개선방안 작성 ' END || printf('%02d', n),
  '가상 개인정보 처리 시나리오의 평가항목을 매핑하고 근거와 개선방안을 작성하세요.',
  'CASE_ANALYSIS',
  CASE WHEN n % 3 = 0 THEN 'HARD' WHEN n % 3 = 1 THEN 'EASY' ELSE 'MEDIUM' END,
  '독립 작성한 개인정보 영향평가 학습 샘플입니다.',
  '처리 흐름, 침해요인과 평가항목의 연결을 다시 확인하세요.',
  'PUBLISHED',
  'INDEPENDENT_DEVELOPMENT_SAMPLE',
  '2026-07-27',
  1,
  '{"autoGrade":"privacy-assessment-rule"}',
  1,
  'user-admin',
  'user-super-admin',
  CURRENT_TIMESTAMP
FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 25)
INSERT OR IGNORE INTO question_courses (question_id, course_id, weight)
SELECT 'practical-pia-question-' || printf('%02d', n), 'course-pia', 100 FROM nums;

WITH RECURSIVE nums(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM nums WHERE n < 15)
INSERT OR IGNORE INTO content_course_links
  (id, content_type, content_id, course_id, relation_type, display_order)
SELECT 'link-privacy-scenario-' || printf('%02d', n), 'PRIVACY_SCENARIO',
       'privacy-scenario-' || printf('%02d', n), 'course-pia', 'PRACTICE', n
FROM nums;

-- 위 실무형 Seed 이후 생성되는 영향평가 항목과 문제의 기준선도 보완한다.
INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-pia-item-' || id, 'PRIVACY_IMPACT_ITEM', id,
       (SELECT course_id FROM course_specializations
        WHERE feature_type = 'PRIVACY_IMPACT_ASSESSMENT' AND active = 1 LIMIT 1),
       code || ' ' || title, effective_date, version, 'published',
       json_object('code', code, 'category', category, 'title', title,
         'description', description, 'checkPoints', check_points,
         'evidenceExamples', evidence_examples, 'riskExamples', risk_examples,
         'improvementExamples', improvement_examples,
         'effectiveDate', effective_date, 'active', active),
       updated_at, 'user-super-admin', updated_at,
       '[개발용 Seed] 기존 영향평가 항목 기준선', 1, 'user-super-admin'
FROM privacy_impact_assessment_items;

INSERT OR IGNORE INTO content_revisions
  (id, content_type, content_id, course_id, title, content_date, version,
   revision_status, snapshot_json, reviewed_at, reviewed_by, published_at,
   change_summary, is_latest, created_by)
SELECT 'revision-question-' || q.id, 'QUESTION_EXPLANATION', q.id,
       (SELECT course_id FROM question_courses qc WHERE qc.question_id = q.id LIMIT 1),
       q.title, coalesce(q.source_date, substr(q.updated_at, 1, 10)),
       cast(q.version AS text), 'published',
       json_object('title', q.title, 'explanation', q.explanation,
         'wrongAnswerExplanation', q.wrong_answer_explanation,
         'source', q.source, 'sourceDate', q.source_date),
       coalesce(q.published_at, q.updated_at), 'user-super-admin',
       coalesce(q.published_at, q.updated_at),
       '[개발용 Seed] 기존 문제 해설 기준선', 1, 'user-super-admin'
FROM questions q WHERE q.status = 'PUBLISHED';
