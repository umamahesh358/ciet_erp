"""Clear application data from the configured MongoDB database.

This deletes documents from application collections while preserving Django
metadata needed for migrations/content types/permissions.
"""

from pathlib import Path
from pymongo import MongoClient


PRESERVE_COLLECTIONS = {
    "django_migrations",
    "django_content_type",
    "auth_permission",
}


def read_env(path):
    values = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main():
    root = Path(__file__).resolve().parent.parent
    env = read_env(root / ".env")
    uri = env.get("MONGODB_URI") or "mongodb://127.0.0.1:27017/erp_portal"
    db_name = env.get("MONGODB_NAME") or "erp_portal"

    client = MongoClient(uri, serverSelectionTimeoutMS=30000)
    client.admin.command("ping")
    db = client[db_name]

    print(f"Cleaning MongoDB database: {db_name}")
    for name in sorted(db.list_collection_names()):
        if name.startswith("system."):
            continue
        count = db[name].count_documents({})
        if name in PRESERVE_COLLECTIONS:
            print(f"PRESERVE {count:5} {name}")
            continue
        deleted = db[name].delete_many({}).deleted_count
        print(f"DELETE   {deleted:5} {name}")
    print("Cleanup complete.")


if __name__ == "__main__":
    main()
