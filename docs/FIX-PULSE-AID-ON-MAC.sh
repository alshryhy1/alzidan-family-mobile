#!/usr/bin/env bash
# حدّث المحاكي على فرع فرص المساعدة في النبض، واطبع إثبات أن الملفات صحيحة.
set -euo pipefail

ROOT="${1:-$HOME/alzidan-family-mobile}"
if [[ ! -d "$ROOT/.git" ]]; then
  echo "المجلد غير موجود أو ليس git: $ROOT"
  echo "شغّل: bash docs/FIX-PULSE-AID-ON-MAC.sh /المسار/الصحيح"
  exit 1
fi

cd "$ROOT"
echo "== المسار =="
pwd

echo "== جلب الفرع =="
git fetch origin cursor/aid-pulse-giving-e8cc
git checkout cursor/aid-pulse-giving-e8cc
git reset --hard origin/cursor/aid-pulse-giving-e8cc

echo "== إثبات الكود =="
git rev-parse --short HEAD
git branch --show-current
if ! grep -q "aidHeroBand" src/screens/HomeScreen.tsx; then
  echo "فشل: HomeScreen بلا aidHeroBand — لست على الفرع الصحيح"
  exit 1
fi
if ! grep -q "فرص مساعدة" src/screens/HomeScreen.tsx; then
  echo "فشل: لا يوجد نص فرص مساعدة"
  exit 1
fi
echo "OK: HomeScreen فيه فرص مساعدة في ترويسة النبض"

ENV_FILE=""
if [[ -f .env ]]; then ENV_FILE=".env"; fi
if [[ -f .env.local ]]; then ENV_FILE=".env.local"; fi
if [[ -z "$ENV_FILE" ]]; then
  echo "فشل: لا يوجد .env ولا .env.local"
  echo "انسخ مفاتيح المشروع:"
  echo "  cp /مسار/نسخة-قديمة/.env .env"
  echo "أو أنشئ .env من .env.example وضع EXPO_PUBLIC_SUPABASE_URL و EXPO_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

echo "== ملف البيئة: $ENV_FILE =="
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a
if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "فشل: المفاتيح ناقصة داخل $ENV_FILE"
  exit 1
fi
echo "OK: supabase url=${EXPO_PUBLIC_SUPABASE_URL:0:32}..."

echo "== فحص RPC من الجهاز =="
COUNT="$(curl -sS -X POST "${EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/public_aid_requests_published_v1" \
  -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${EXPO_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('rows') or []) if isinstance(d,dict) else 0)")"
echo "published_via_anon=$COUNT"
if [[ "$COUNT" -lt 1 ]]; then
  echo "تحذير: anon ما رجّع صفوفاً — راجع SQL العامة أو المفاتيح"
fi

echo "== تشغيل Expo بمسح الكاش =="
rm -rf .expo node_modules/.cache 2>/dev/null || true
npx expo start -c
