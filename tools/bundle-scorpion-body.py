"""Compatibility entry point used by the FBX conversion script."""
from pathlib import Path
import runpy
builder=runpy.run_path(str(Path(__file__).with_name('bundle-car-bodies.py')))
builder['bundle']('scorpion')
