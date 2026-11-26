import unittest
from datetime import datetime

from refresh import latest_close


class MarketCloseTest(unittest.TestCase):
    def test_month_boundary(self):
        self.assertEqual(latest_close(datetime.fromisoformat("2026-11-01T01:00:00+00:00")), "2026-10-30")

    def test_year_boundary(self):
        self.assertEqual(latest_close(datetime.fromisoformat("2026-01-02T01:00:00+00:00")), "2025-12-31")

    def test_early_close(self):
        self.assertEqual(latest_close(datetime.fromisoformat("2025-11-28T19:59:00+00:00")), "2025-11-26")
        self.assertEqual(latest_close(datetime.fromisoformat("2025-11-28T20:00:00+00:00")), "2025-11-28")


if __name__ == "__main__":
    unittest.main()
