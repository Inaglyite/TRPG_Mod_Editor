#!/usr/bin/env python3
"""Package an already-built relative-base editor for TRPG Master updates."""

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


def package(dist: Path, output: Path, version: str, notes: str):
    if not re.fullmatch(r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", version):
        raise ValueError("version must be major.minor.patch")
    html = (dist / "index.html").read_text(encoding="utf-8")
    if 'src="/assets/' in html or 'href="/assets/' in html or 'src="/editor/' in html:
        raise ValueError("web updates must use Vite base ./")
    metadata = {"version": version, "editor_api": 1}
    (dist / "editor-build.json").write_text(json.dumps(metadata) + "\n", encoding="utf-8")
    output.mkdir(parents=True, exist_ok=True)
    archive = output / "editor-web.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(dist.rglob("*")):
            if path.is_file():
                bundle.write(path, path.relative_to(dist).as_posix())
    data = archive.read_bytes()
    manifest = {**metadata, "sha256": hashlib.sha256(data).hexdigest(),
                "size": len(data), "notes": notes}
    (output / "editor-web-update.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--notes-file", type=Path, required=True)
    args = parser.parse_args()
    result = package(args.dist, args.output, args.version,
                     args.notes_file.read_text(encoding="utf-8"))
    print(f'Packaged editor v{result["version"]}, SHA256 {result["sha256"]}')
