"""Published marketing solutions; localization never changes routing or readiness."""
import json
from pathlib import Path


def _load_catalog():
    records = json.loads(Path(__file__).with_name("solutions.json").read_text(encoding="utf-8"))
    catalogs = {"ar": [], "en": []}
    for order, record in enumerate(records, start=1):
        shared = {key: record[key] for key in ("id", "group", "status", "icon", "related")}
        for lang, catalog in catalogs.items():
            catalog.append({**shared, "order": order, **record[lang]})
    return catalogs


CATALOGS = _load_catalog()
SERVICES = CATALOGS["ar"]
REQUESTABLE_IDS = {s["id"] for s in SERVICES if s["status"] != "planned"}
LEGACY_REDIRECTS = {"whatsapp-api": "/services/channel-api", "platform": "/pricing"}
RETIRED_IDS = {"whatsapp-sales", "sales-system", "stores", "training", "consulting", "assessment", "recruitment", "sales-plan"}
CONSENT='أوافق على التواصل معي بخصوص طلب الخدمة، وعلى معالجة بيانات الطلب لهذا الغرض.'
