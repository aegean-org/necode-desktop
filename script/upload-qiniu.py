#!/usr/bin/env python3

import argparse
import os
from pathlib import Path, PurePosixPath
from urllib.parse import quote


ENVIRONMENT_NAMES = (
    "QINIU_ACCESS_KEY",
    "QINIU_SECRET_KEY",
    "QINIU_BUCKET",
    "QINIU_PREFIX",
    "QINIU_CDN_BASE",
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload release assets to Qiniu and refresh their CDN URLs")
    parser.add_argument("directory", type=Path, help="Directory containing release assets")
    args = parser.parse_args()

    missing = [name for name in ENVIRONMENT_NAMES if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    directory = args.directory.resolve()
    if not directory.is_dir():
        raise RuntimeError(f"Upload directory does not exist or is not a directory: {directory}")

    files = sorted(path for path in directory.rglob("*") if path.is_file())
    if not files:
        raise RuntimeError(f"Upload directory contains no files: {directory}")

    prefix = os.environ["QINIU_PREFIX"].strip("/")
    if not prefix:
        raise RuntimeError("QINIU_PREFIX must contain a non-slash path segment")

    cdn_base = f"{os.environ['QINIU_CDN_BASE'].rstrip('/')}/"
    from qiniu import Auth, CdnManager, put_file

    auth = Auth(os.environ["QINIU_ACCESS_KEY"], os.environ["QINIU_SECRET_KEY"])
    token = auth.upload_token(os.environ["QINIU_BUCKET"])
    refresh_urls = []

    for path in files:
        relative_path = PurePosixPath(path.relative_to(directory))
        key = f"{prefix}/{relative_path}"
        print(f"Uploading {relative_path} to {key}")
        _, info = put_file(token, key, str(path))
        if info.status_code != 200:
            raise RuntimeError(f"Qiniu upload failed for {key}: {info.error}")
        refresh_urls.append(f"{cdn_base}{quote(str(relative_path), safe='/')}")

    print(f"Refreshing {len(refresh_urls)} CDN URLs")
    _, info = CdnManager(auth).refresh_urls(refresh_urls)
    if info.status_code != 200:
        raise RuntimeError(f"Qiniu CDN refresh failed: {info.error}")


if __name__ == "__main__":
    main()
