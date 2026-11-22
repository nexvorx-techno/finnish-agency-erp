import sqlite3
import pg8000.native

def clean_database():
    print("=== Cleaning Supabase PostgreSQL Database ===")
    c = pg8000.native.Connection(
        user='postgres.fsvjbmuspbxqhasswlkb',
        host='aws-1-ap-southeast-1.pooler.supabase.com',
        port=5432,
        password='Rishikesh@1996',
        database='postgres'
    )
    
    tables_to_truncate = [
        'interview_slots',
        'candidate_shortlists',
        'job_requisitions',
        'relocation_milestones',
        'biometric_logs',
        'timesheet_shifts',
        'worker_deployments',
        'shift_allocation_entries',
        'shift_change_requests',
        'shift_roster_plans',
        'worker_daily_shifts',
        'internal_chat_messages',
        'client_notifications',
        'client_approval_flows'
    ]
    
    for t in tables_to_truncate:
        c.run(f"TRUNCATE TABLE {t} CASCADE;")
        print(f"  ✓ Truncated {t}")
        
    # Keep ONLY client admin in client_users
    c.run("DELETE FROM client_users WHERE role != 'CLIENT_ADMIN';")
    admin_users = c.run("SELECT id, full_name, email, role FROM client_users;")
    print(f"  ✓ Retained Client Admin account: {admin_users}")
    
    c.close()
    
    print("\n=== Cleaning Local SQLite Database (agency_erp.db) ===")
    sq_conn = sqlite3.connect("agency_erp.db")
    sq_cur = sq_conn.cursor()
    for t in tables_to_truncate:
        sq_cur.execute(f"DELETE FROM {t};")
        print(f"  ✓ Cleared {t}")
    sq_cur.execute("DELETE FROM client_users WHERE role != 'CLIENT_ADMIN';")
    sq_conn.commit()
    sq_conn.close()
    print("  ✓ Local SQLite cleaned successfully!")

if __name__ == "__main__":
    clean_database()
