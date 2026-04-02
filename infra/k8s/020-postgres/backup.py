#!/usr/bin/env -S uv run
# /// script
# dependencies = [
#   "google-cloud-storage",
# ]
# ///
"""PostgreSQL backup/restore with GCS storage.

Env vars:
  DATABASE_URL             - postgres connection string
  GCS_BACKUP_BUCKET        - GCS bucket name
  GCP_SERVICE_ACCOUNT_KEY  - service account JSON (or use GOOGLE_APPLICATION_CREDENTIALS)

Usage:
  ./backup.py backup              # dump, upload, cleanup old
  ./backup.py list                # list all backups
  ./backup.py restore <filename>  # restore from backup
"""

import argparse
import gzip
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

from google.cloud import storage
from google.oauth2 import service_account

PREFIX = "postgresql-backups/"


def get_bucket():
    key = os.environ.get("GCP_SERVICE_ACCOUNT_KEY")
    if key:
        info = json.loads(key)
        creds = service_account.Credentials.from_service_account_info(info)
        client = storage.Client(credentials=creds, project=info.get("project_id"))
    else:
        client = storage.Client()
    return client.bucket(os.environ["GCS_BACKUP_BUCKET"])


def cmd_backup():
    db_url = os.environ["DATABASE_URL"]
    now = datetime.now(timezone.utc)
    filename = f"pg_dumpall-{now:%Y-%m-%d-%H-%M}.sql.gz"

    # Extract password from URL for pg_dumpall's child pg_dump processes
    from urllib.parse import urlparse
    parsed = urlparse(db_url)
    env = {**os.environ}
    if parsed.password:
        env["PGPASSWORD"] = parsed.password

    print("==> Dumping all databases...")
    with tempfile.NamedTemporaryFile(suffix=".sql.gz", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        proc = subprocess.Popen(
            [
                "pg_dumpall", "--clean", "--if-exists",
                "--quote-all-identifiers", "--no-password", "--dbname", db_url,
            ],
            stdout=subprocess.PIPE,
            env=env,
        )
        with gzip.open(tmp_path, "wb") as gz:
            while chunk := proc.stdout.read(65536):
                gz.write(chunk)
        if proc.wait() != 0:
            print("==> pg_dumpall failed!", file=sys.stderr)
            sys.exit(1)

        size = os.path.getsize(tmp_path)
        print(f"==> Dump complete: {filename} ({size:,} bytes)")

        bucket = get_bucket()
        blob = bucket.blob(f"{PREFIX}{filename}")
        print(f"==> Uploading to gs://{bucket.name}/{PREFIX}{filename}")
        blob.upload_from_filename(tmp_path)
        print("==> Upload complete!")
    finally:
        os.unlink(tmp_path)

    cleanup(bucket)


def parse_backup_time(name):
    try:
        s = name.removeprefix("pg_dumpall-").removesuffix(".sql.gz")
        return datetime.strptime(s, "%Y-%m-%d-%H-%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def cleanup(bucket=None):
    """Retention: 3 from today, 2 from yesterday, 1 weekly (>= 7 days old)."""
    if bucket is None:
        bucket = get_bucket()

    backups = []
    for blob in bucket.list_blobs(prefix=PREFIX):
        dt = parse_backup_time(blob.name.removeprefix(PREFIX))
        if dt:
            backups.append((dt, blob))
    if not backups:
        return

    backups.sort(key=lambda x: x[0], reverse=True)
    now = datetime.now(timezone.utc)
    today = now.date()
    yesterday = today - timedelta(days=1)
    week_ago = today - timedelta(days=7)

    keep = set()

    # 3 most recent from today
    n = 0
    for dt, b in backups:
        if dt.date() == today:
            keep.add(b.name)
            n += 1
            if n >= 3:
                break

    # 2 most recent from yesterday
    n = 0
    for dt, b in backups:
        if dt.date() == yesterday:
            keep.add(b.name)
            n += 1
            if n >= 2:
                break

    # 1 most recent per day for days 2–6
    for days_ago in range(2, 7):
        target_date = today - timedelta(days=days_ago)
        for dt, b in backups:
            if dt.date() == target_date:
                keep.add(b.name)
                break

    # 1 most recent that's >= 7 days old
    for dt, b in backups:
        if dt.date() <= week_ago:
            keep.add(b.name)
            break

    to_delete = [(dt, b) for dt, b in backups if b.name not in keep]
    for _, b in to_delete:
        print(f"  Deleting {b.name.removeprefix(PREFIX)}")
        b.delete()

    if to_delete:
        print(f"==> Cleanup: kept {len(keep)}, deleted {len(to_delete)}")


def cmd_list():
    bucket = get_bucket()
    blobs = sorted(bucket.list_blobs(prefix=PREFIX), key=lambda b: b.name, reverse=True)
    if not blobs:
        print("No backups found.")
        return
    for blob in blobs:
        name = blob.name.removeprefix(PREFIX)
        size_mb = (blob.size or 0) / (1024 * 1024)
        print(f"  {name}  {size_mb:.1f} MB  {blob.time_created:%Y-%m-%d %H:%M}")


def cmd_restore(filename):
    db_url = os.environ["DATABASE_URL"]
    bucket = get_bucket()
    blob = bucket.blob(f"{PREFIX}{filename}")
    if not blob.exists():
        print(f"Backup not found: {filename}", file=sys.stderr)
        sys.exit(1)

    with tempfile.NamedTemporaryFile(suffix=".sql.gz", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        print(f"==> Downloading {filename}...")
        blob.download_to_filename(tmp_path)
        size = os.path.getsize(tmp_path)
        print(f"==> Downloaded ({size:,} bytes)")

        print("==> Restoring...")
        with gzip.open(tmp_path, "rb") as gz:
            proc = subprocess.run(["psql", db_url], stdin=gz)
        if proc.returncode != 0:
            print("==> Restore failed!", file=sys.stderr)
            sys.exit(1)
        print("==> Restore complete!")
    finally:
        os.unlink(tmp_path)


def main():
    parser = argparse.ArgumentParser(description="PostgreSQL backup to GCS")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("backup", help="Dump, upload to GCS, cleanup old backups")
    sub.add_parser("list", help="List all backups in GCS")
    p = sub.add_parser("restore", help="Restore from a GCS backup")
    p.add_argument("filename", help="Backup filename (from 'list' output)")

    args = parser.parse_args()
    if args.command == "backup":
        cmd_backup()
    elif args.command == "list":
        cmd_list()
    elif args.command == "restore":
        cmd_restore(args.filename)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
