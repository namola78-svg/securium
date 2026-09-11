from __future__ import annotations

import hashlib
import json
from pathlib import Path
import pickle
import tempfile
import unittest

from .secure import (
    DeserializationPolicyError,
    IntegrityBoundaryError,
    MAX_REQUEST_BYTES,
    ImportRecord,
    insert_records_secure,
    load_trusted_migration_artifact,
    make_database as make_secure_database,
    parse_request_secure,
    search_records_secure,
)
from .vulnerable import (
    load_legacy_artifact_vulnerable,
    load_pickle_request_vulnerable,
    make_database as make_vulnerable_database,
    mark_untrusted_execution,
    parse_request_vulnerable,
    search_records_vulnerable,
)


class _MarkerPayload:
    def __init__(self, marker_path: Path) -> None:
        self.marker_path = marker_path

    def __reduce__(self):  # type: ignore[no-untyped-def]
        return mark_untrusted_execution, (str(self.marker_path),)


def request_payload(records: list[dict[str, str]]) -> bytes:
    return json.dumps({"records": records}, separators=(",", ":")).encode("utf-8")


class M03DeserializationTests(unittest.TestCase):
    def test_normal_json_import_and_parameterized_search_work(self) -> None:
        connection = make_secure_database()
        self.addCleanup(connection.close)
        records = parse_request_secure(
            request_payload([{"name": "carol", "role": "user"}])
        )
        self.assertEqual(records, [ImportRecord(name="carol", role="user")])
        insert_records_secure(connection, records)
        self.assertEqual(
            [row[1] for row in search_records_secure(connection, "car")],
            ["carol"],
        )

    def test_untrusted_pickle_executes_marker_but_request_parser_rejects_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "vulnerable-marker.txt"
            payload = pickle.dumps(_MarkerPayload(marker))

            load_pickle_request_vulnerable(payload)
            self.assertEqual(marker.read_text(encoding="utf-8"), "pickle-untrusted-executed\n")

            secure_marker = Path(directory) / "secure-marker.txt"
            secure_payload = pickle.dumps(_MarkerPayload(secure_marker))
            with self.assertRaises(DeserializationPolicyError):
                parse_request_secure(secure_payload)
            self.assertFalse(secure_marker.exists())

    def test_schema_size_and_depth_policy_rejects_inputs_the_vulnerable_parser_accepts(self) -> None:
        extra_field = json.dumps(
            {"records": [{"name": "alice", "role": "user", "debug": True}]}
        ).encode("utf-8")
        self.assertIsInstance(parse_request_vulnerable(extra_field), dict)
        with self.assertRaises(DeserializationPolicyError):
            parse_request_secure(extra_field)

        oversized = request_payload([{"name": "x" * MAX_REQUEST_BYTES, "role": "user"}])
        self.assertIsInstance(parse_request_vulnerable(oversized), dict)
        with self.assertRaises(DeserializationPolicyError):
            parse_request_secure(oversized)

        deeply_nested: object = "leaf"
        for _ in range(8):
            deeply_nested = [deeply_nested]
        deep_payload = json.dumps({"records": [], "extra": deeply_nested}).encode("utf-8")
        self.assertIsInstance(parse_request_vulnerable(deep_payload), dict)
        with self.assertRaises(DeserializationPolicyError):
            parse_request_secure(deep_payload)

    def test_parameterized_search_rejects_sql_payload_while_normal_search_remains(self) -> None:
        vulnerable_connection = make_vulnerable_database()
        self.addCleanup(vulnerable_connection.close)
        secure_connection = make_secure_database()
        self.addCleanup(secure_connection.close)
        payload = "%' OR 1=1 --"

        self.assertEqual(len(search_records_vulnerable(vulnerable_connection, payload)), 2)
        self.assertEqual(search_records_secure(secure_connection, payload), [])
        self.assertEqual(
            [row[1] for row in search_records_secure(secure_connection, "ali")],
            ["alice"],
        )

    def test_trusted_application_artifact_is_digest_checked_before_pickle_load(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "migration.pkl"
            trusted = {"records": [{"name": "legacy", "role": "user"}]}
            artifact.write_bytes(pickle.dumps(trusted))
            digest = hashlib.sha256(artifact.read_bytes()).hexdigest()

            self.assertEqual(
                load_trusted_migration_artifact(artifact, root, digest),
                [ImportRecord(name="legacy", role="user")],
            )

            marker = root / "tampered-marker.txt"
            artifact.write_bytes(pickle.dumps(_MarkerPayload(marker)))
            with self.assertRaises(IntegrityBoundaryError):
                load_trusted_migration_artifact(artifact, root, digest)
            self.assertFalse(marker.exists())

            load_legacy_artifact_vulnerable(artifact)
            self.assertTrue(marker.exists())

    def test_secure_artifact_loader_rejects_path_outside_application_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "app"
            root.mkdir()
            outside = Path(directory) / "outside.pkl"
            outside.write_bytes(pickle.dumps({"records": []}))
            digest = hashlib.sha256(outside.read_bytes()).hexdigest()

            with self.assertRaises(IntegrityBoundaryError):
                load_trusted_migration_artifact(outside, root, digest)


if __name__ == "__main__":
    unittest.main()
