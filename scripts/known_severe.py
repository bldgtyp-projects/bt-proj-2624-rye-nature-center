"""The one accepted EnergyPlus severe for the 3 November 2026 runs (Ed, 2026-11-03).

PolygonClipping applies the tree-canopy transmittance schedule but reports 39
non-convex casting surfaces. It is an accuracy notice, not a failed run. Any
other severe or any fatal error still fails the export.
"""
import re

KNOWN = 'DetermineShadowingCombinations: There are 39 surfaces which are casting surfaces and are non-convex.'
NOTE = '39 non-convex casting surfaces under PolygonClipping shading (accepted 2026-11-03): an accuracy notice, not a failed run'


def check_severe(error_text: str) -> int:
    """Return the severe count after confirming only the accepted notice is present."""
    severes = re.findall(r'\*\*\s+Severe\s+\*\*\s+(.*)', error_text)
    assert not re.search(r'\*\*\s+Fatal\s+\*\*', error_text)
    assert all(s.strip() == KNOWN for s in severes), severes
    summary = re.findall(r'Completed Successfully-- \d+ Warning; (\d+) Severe Errors', error_text)
    assert summary and all(int(n) in (0, 39) for n in summary), summary
    return int(summary[-1])
