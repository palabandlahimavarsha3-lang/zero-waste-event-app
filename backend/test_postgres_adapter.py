import unittest
from database import adapt_sql_for_postgres, PostgresCursorWrapper

class MockCursor:
    def __init__(self):
        self.executed_query = None
        self.executed_params = None
        self.rowcount = 1
        self.description = [("id",), ("name",)]
        self._results = []

    def execute(self, query, params=None):
        self.executed_query = query
        self.executed_params = params
        if "RETURNING" in query.upper():
            self._results = [{"id": 42}]

    def executemany(self, query, params_list):
        self.executed_query = query
        self.executed_params = params_list

    def fetchone(self):
        return self._results.pop(0) if self._results else None

    def fetchall(self):
        return self._results

    def close(self):
        pass


class TestPostgresAdapter(unittest.TestCase):
    def test_sql_adaptation(self):
        # 1. Parameter conversion
        sql = "SELECT * FROM events WHERE id = ? AND status = ?"
        self.assertEqual(
            adapt_sql_for_postgres(sql),
            "SELECT * FROM events WHERE id = %s AND status = %s"
        )

        # 2. Primary key autoincrement
        create_sql = "CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
        self.assertEqual(
            adapt_sql_for_postgres(create_sql),
            "CREATE TABLE events (id SERIAL PRIMARY KEY, name TEXT)"
        )

        # 3. strftime conversion
        strftime_sql = "SELECT strftime('%m', created_at) AS m FROM waste_reports GROUP BY strftime('%Y-%m', created_at)"
        adapted_strftime = adapt_sql_for_postgres(strftime_sql)
        self.assertIn("to_char(created_at::timestamp, 'MM')", adapted_strftime)
        self.assertIn("to_char(created_at::timestamp, 'YYYY-MM')", adapted_strftime)

        # 4. datetime('now') conversion
        now_sql = "UPDATE events SET updated_at = datetime('now')"
        self.assertEqual(
            adapt_sql_for_postgres(now_sql),
            "UPDATE events SET updated_at = CURRENT_TIMESTAMP"
        )

        # 5. Round numeric conversion
        round_sql = "SELECT ROUND(COALESCE(SUM(w.amount_kg), 0), 2) AS total_waste_kg"
        adapted_round = adapt_sql_for_postgres(round_sql)
        self.assertIn("::numeric", adapted_round)

    def test_cursor_wrapper_insert_returning(self):
        mock = MockCursor()
        wrapper = PostgresCursorWrapper(mock)
        insert_sql = "INSERT INTO events (name, venue) VALUES (?, ?)"
        wrapper.execute(insert_sql, ("SRIT Conclave", "Auditorium"))

        # Verifies query was adapted, RETURNING id appended, and lastrowid populated
        self.assertTrue(mock.executed_query.strip().endswith("RETURNING id"))
        self.assertEqual(wrapper.lastrowid, 42)


if __name__ == "__main__":
    unittest.main()
