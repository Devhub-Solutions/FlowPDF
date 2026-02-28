#!/usr/bin/env python3
import os
import glob
from app.services.db_repository import db_list_templates, db_update_template


def main():
    templates = db_list_templates()
    print(f"Found {len(templates)} templates in DB")
    for t in templates:
        tid = t.get('id')
        file_path = t.get('file_path') or ''
        if file_path and os.path.exists(file_path):
            print(f"OK: {tid} -> exists: {file_path}")
            continue

        # Try to find by filename under storage/raw
        filename = os.path.basename(file_path) if file_path else t.get('name')
        candidates = glob.glob(f"/app/storage/templates/raw/*{filename}")
        if candidates:
            newpath = candidates[0]
            db_update_template(tid, file_path=newpath)
            print(f"Updated: {tid} -> {newpath}")
        else:
            print(f"Missing: {tid} -> {filename} (no candidate found)")


if __name__ == '__main__':
    main()
