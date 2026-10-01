CREATE TABLE `user_auth_identity_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `auth_system` text NOT NULL,
  `auth_provider` text NOT NULL,
  `auth_issuer` text NOT NULL,
  `auth_project_ref` text NOT NULL,
  `environment_class` text NOT NULL,
  `auth_subject` text NOT NULL,
  `application_user_id` text NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
  `status` text NOT NULL CHECK (`status` IN ('PENDING', 'ACTIVE', 'REVOKED', 'SUPERSEDED')),
  `revoked_at` text,
  `revoked_by` text,
  -- Optional explanatory detail; timestamp plus actor provide terminal attribution.
  `revocation_reason` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` text NOT NULL,
  CHECK (
    (`status` IN ('REVOKED', 'SUPERSEDED') AND `revoked_at` IS NOT NULL AND `revoked_by` IS NOT NULL)
    OR (`status` IN ('PENDING', 'ACTIVE') AND `revoked_at` IS NULL AND `revoked_by` IS NULL AND `revocation_reason` IS NULL)
  )
);
CREATE UNIQUE INDEX `user_auth_identity_bindings_tuple_unique`
  ON `user_auth_identity_bindings` (`auth_system`, `auth_provider`, `auth_issuer`, `auth_project_ref`, `environment_class`, `auth_subject`);
CREATE INDEX `user_auth_identity_bindings_user_status_idx`
  ON `user_auth_identity_bindings` (`application_user_id`, `status`);
CREATE TRIGGER `user_auth_identity_bindings_no_delete`
BEFORE DELETE ON `user_auth_identity_bindings`
BEGIN
  SELECT RAISE(ABORT, 'AUTH_IDENTITY_BINDING_HISTORY_APPEND_ONLY');
END;
CREATE TRIGGER `user_auth_identity_bindings_identity_immutable`
BEFORE UPDATE OF `id`, `auth_system`, `auth_provider`, `auth_issuer`, `auth_project_ref`, `environment_class`, `auth_subject`, `application_user_id`, `created_at`, `created_by`
ON `user_auth_identity_bindings`
WHEN OLD.`id` IS NOT NEW.`id`
  OR OLD.`auth_system` IS NOT NEW.`auth_system`
  OR OLD.`auth_provider` IS NOT NEW.`auth_provider`
  OR OLD.`auth_issuer` IS NOT NEW.`auth_issuer`
  OR OLD.`auth_project_ref` IS NOT NEW.`auth_project_ref`
  OR OLD.`environment_class` IS NOT NEW.`environment_class`
  OR OLD.`auth_subject` IS NOT NEW.`auth_subject`
  OR OLD.`application_user_id` IS NOT NEW.`application_user_id`
  OR OLD.`created_at` IS NOT NEW.`created_at`
  OR OLD.`created_by` IS NOT NEW.`created_by`
BEGIN
  SELECT RAISE(ABORT, 'AUTH_IDENTITY_BINDING_TUPLE_IMMUTABLE');
END;
CREATE TRIGGER `user_auth_identity_bindings_terminal_immutable`
BEFORE UPDATE ON `user_auth_identity_bindings`
WHEN OLD.`status` IN ('REVOKED', 'SUPERSEDED')
BEGIN
  SELECT RAISE(ABORT, 'AUTH_IDENTITY_BINDING_TERMINAL_STATE_IMMUTABLE');
END;
CREATE TRIGGER `user_auth_identity_bindings_transition_check`
BEFORE UPDATE OF `status` ON `user_auth_identity_bindings`
WHEN (OLD.`status` = 'PENDING' AND NEW.`status` NOT IN ('PENDING', 'ACTIVE', 'REVOKED', 'SUPERSEDED'))
  OR (OLD.`status` = 'ACTIVE' AND NEW.`status` NOT IN ('ACTIVE', 'REVOKED', 'SUPERSEDED'))
BEGIN
  SELECT RAISE(ABORT, 'AUTH_IDENTITY_BINDING_STATUS_TRANSITION_INVALID');
END;
