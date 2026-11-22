import pg8000.native

c = pg8000.native.Connection(
    host='aws-1-ap-southeast-1.pooler.supabase.com',
    port=5432,
    user='postgres.fsvjbmuspbxqhasswlkb',
    password='Rishikesh@1996',
    database='postgres'
)
tables = c.run("SELECT tablename FROM pg_tables WHERE schemaname='public'")
print("Tables in Supabase public schema:", [r[0] for r in tables])
for t in tables:
    cnt = c.run(f"SELECT COUNT(*) FROM {t[0]}")
    print(f"  {t[0]}: {cnt[0][0]} rows")
c.close()
