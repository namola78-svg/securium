// Historical non-migration receipts intentionally written into app_schema_migrations
// by reviewed PostgreSQL seed generators. These receipts prove seed execution only;
// they never satisfy numbered migration progression or migration applicability.
export const HISTORICAL_SUPPLEMENTARY_RECEIPTS = Object.freeze({
  seed_application_security_questions_2027_2029:
    "manual-application-security-questions-2027-2029",
  seed_information_security_general_questions_2027_2029:
    "manual-information-security-general-questions-2027-2029",
  seed_management_law_questions_2027_2029:
    "manual-management-law-questions-2027-2029",
  seed_network_security_questions_2027_2029:
    "manual-network-security-questions-2027-2029",
  seed_security_certification_course_lessons_2027_2029:
    "manual-security-certification-course-lessons-2027-2029",
  seed_system_security_questions_2027_2029:
    "manual-system-security-questions-2027-2029",
});

export function expectedHistoricalSupplementaryReceiptChecksum(id) {
  return HISTORICAL_SUPPLEMENTARY_RECEIPTS[id] ?? null;
}
