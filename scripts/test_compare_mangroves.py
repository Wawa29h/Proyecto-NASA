"""Targeted invariants for the stage-1 comparison generator; no network or models."""
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image

from compare_mangroves import build_site, common_signal_change, water_area


class ComparisonTests(unittest.TestCase):
    def test_change_numerator_uses_same_support_as_denominator(self):
        data = np.zeros((6, 1, 3), dtype=np.float32)
        data[3:, 0, 0] = -4
        data[3:, 0, 1] = 4
        data[0, 0, 2] = np.nan
        data[3:, 0, 2] = -10
        support, loss, gain = common_signal_change(data, np.ones((1, 3), bool))
        self.assertEqual(int(support.sum()), 2)
        self.assertEqual((loss, gain), (1, 1))

    def test_missing_common_support_is_not_zero_change(self):
        with self.assertRaisesRegex(ValueError, "Sin soporte comun"):
            common_signal_change(np.full((6, 1, 2), np.nan), np.ones((1, 2), bool))

    def test_windows_must_not_overlap(self):
        with self.assertRaisesRegex(ValueError, "seis observaciones"):
            common_signal_change(np.zeros((5, 1, 1)), np.ones((1, 1), bool))

    def test_water_is_counted_from_classification_not_series(self):
        pixels = np.array([[(30, 136, 229, 230), (20, 50, 90, 90), (60, 220, 90, 235)]], dtype=np.uint8)
        self.assertEqual(water_area(pixels, 0.25), 0.25)

    def test_inconsistent_source_series_blocks_regeneration(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            base = root / "web/data"
            (base / "ref").mkdir(parents=True)
            (root / "web/sites.json").write_text("[]", encoding="utf-8")
            Image.fromarray(np.full((1, 2), 95, np.uint8)).save(base / "ref/worldcover_codes.png")
            Image.fromarray(np.full((1, 2), 120, np.uint8)).save(base / "hh.png")
            Image.fromarray(np.full((1, 2, 4), 255, np.uint8)).save(base / "rgb.png")
            Image.fromarray(np.zeros((1, 2, 4), np.uint8)).save(base / "cls.png")
            series = {"bbox": [0, 0, 0.00036, 0.00018], "step": 0.00018,
                      "hh_range": [-30, 5], "dates": [{"id": "a", "date": "2026-01-01",
                      "hh": "hh.png", "rgb": "rgb.png", "cls": "cls.png", "water_km2": 99}]}
            (base / "series.json").write_text(json.dumps(series), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "clasificacion y serie discrepan"):
                build_site(root, "web/data", {})


if __name__ == "__main__":
    unittest.main()
