# Module 04 — SQL Injection

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Parameterized queries → developer → separate query structure from values → JDBC `PreparedStatement`, ORM parameters. Related certification: database/application security domain (conceptual only).

## Lesson

String concatenation lets a value change query structure. Parameters preserve the query plan and bind the value as data. Validation still matters for type, size, and business rules, but it is not the primary SQL injection control. Identifiers such as sort columns are structural choices and should come from a closed map.

```java
PreparedStatement ps = conn.prepareStatement(
    "select id, email from accounts where email = ?");
ps.setString(1, email);
```

This protects the value position, but not authorization, result size, error leakage, timeouts, or database privilege.

## Exercise

Refactor a query with user-selected `orderBy` and `limit`. Parameterize the limit and map `name`, `created`, or `status`; reject other names.

## Instructor notes

Do not present escaping as the preferred fix. A query safe from injection can still expose another user’s rows.

## Learner takeaway

Parameterize values, map structural choices, and enforce authorization separately.
