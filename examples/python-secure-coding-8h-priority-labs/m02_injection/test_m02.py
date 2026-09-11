from __future__ import annotations

import os
import unittest

from .secure import evaluate_filter_secure, run_sort_secure, search_users_secure
from .secure import SORT_COLUMNS
from .vulnerable import (
    evaluate_filter_vulnerable,
    make_database,
    run_sort_vulnerable,
    search_users_vulnerable,
)


class M02InjectionTests(unittest.TestCase):
    def test_normal_sql_search_works_before_and_after_repair(self) -> None:
        connection = make_database()
        self.addCleanup(connection.close)

        self.assertEqual(
            [row[1] for row in search_users_vulnerable(connection, "ali")],
            ["alice"],
        )
        self.assertEqual(
            [row[1] for row in search_users_secure(connection, "ali")],
            ["alice"],
        )

    def test_vulnerable_sql_injection_changes_the_result(self) -> None:
        connection = make_database()
        self.addCleanup(connection.close)

        injected = "%' OR 1=1 --"
        self.assertEqual(len(search_users_vulnerable(connection, injected)), 3)
        self.assertEqual(search_users_secure(connection, injected), [])

    def test_structural_sort_choices_fail_closed(self) -> None:
        connection = make_database()
        self.addCleanup(connection.close)

        self.assertEqual(set(SORT_COLUMNS), {"name", "id"})
        with self.assertRaises(ValueError):
            search_users_secure(connection, "ali", "name; DROP TABLE users")
        self.assertEqual(
            [row[1] for row in search_users_secure(connection, "", "id")],
            ["alice", "bob", "carol"],
        )

    def test_vulnerable_shell_injection_executes_extra_command(self) -> None:
        payload = "safe & echo INJECTED" if os.name == "nt" else "safe; echo INJECTED"

        vulnerable_output = run_sort_vulnerable(payload)
        self.assertIn("INJECTED", vulnerable_output)

        secure_output = run_sort_secure(payload)
        self.assertEqual(secure_output.strip(), payload)

    def test_vulnerable_eval_executes_code_but_secure_parser_rejects_it(self) -> None:
        expression = "__import__('os').getcwd()"
        self.assertTrue(str(evaluate_filter_vulnerable(expression, {})))
        with self.assertRaises(ValueError):
            evaluate_filter_secure(expression, {})
        self.assertTrue(evaluate_filter_secure("role == 'admin'", {"role": "admin"}))
        self.assertFalse(evaluate_filter_secure("role == 'admin'", {"role": "user"}))


if __name__ == "__main__":
    unittest.main()
