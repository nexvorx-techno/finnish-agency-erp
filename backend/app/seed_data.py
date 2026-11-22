from datetime import datetime, date, timedelta
from app.core.database import SessionLocal, Base, engine
from app.models.client import (
    ClientCompany,
    ClientSite,
    ClientUser,
    WorkerDeployment,
    BiometricLog,
    TimesheetShiftRecord
)
from app.models.talent import (
    JobRequisition,
    CandidateShortlist,
    InterviewSlot,
    RelocationMilestone
)

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing data if any
    db.query(InterviewSlot).delete()
    db.query(CandidateShortlist).delete()
    db.query(JobRequisition).delete()
    db.query(RelocationMilestone).delete()
    db.query(BiometricLog).delete()
    db.query(TimesheetShiftRecord).delete()
    db.query(WorkerDeployment).delete()
    db.query(ClientUser).delete()
    db.query(ClientSite).delete()
    db.query(ClientCompany).delete()
    db.commit()

    print("Seeding Finnish industrial client data...")

    # 1. Client Company: Valmet Technologies Oy
    valmet = ClientCompany(
        name="Valmet Technologies Oy",
        business_id="2516487-1",
        vat_number="FI25164871",
        industry="Heavy Machinery & Pulp/Paper Tech",
        billing_address="Keilasatama 5",
        postal_code="02150",
        city="Espoo",
        logo_url="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Valmet_Logo.svg/512px-Valmet_Logo.svg.png",
        payment_terms_days=14,
        is_active=True
    )
    db.add(valmet)
    db.flush()

    # Sites for Valmet
    site_tampere = ClientSite(
        client_id=valmet.id,
        site_name="Tampere Heavy Machinery Works",
        site_code="TMP-01",
        city="Tampere",
        address="Lentokentänkatu 11",
        postal_code="33900",
        tes_industry_sector="Teknologiateollisuus TES",
        biometric_terminal_id="BIO-TMP-GATE-A",
        is_active=True
    )
    site_jyvaskyla = ClientSite(
        client_id=valmet.id,
        site_name="Jyväskylä Foundry & Automation",
        site_code="JYK-02",
        city="Jyväskylä",
        address="Rautpohjankatu 1",
        postal_code="40700",
        tes_industry_sector="Teknologiateollisuus TES",
        biometric_terminal_id="BIO-JYK-GATE-1",
        is_active=True
    )
    db.add_all([site_tampere, site_jyvaskyla])
    db.flush()

    # Single Client Admin User (Assigned by Agency Super Admin)
    user_admin = ClientUser(
        client_id=valmet.id,
        full_name="Client Admin",
        email="admin",
        role="CLIENT_ADMIN",
        assigned_site_ids="*",
        password="Admin@123",
        must_change_password=False,
        module_permissions='{"all": true}',
        is_active=True
    )
    db.add(user_admin)
    db.flush()

    # Worker Deployments
    workers = [
        {"id": 101, "name": "Jari Mäkinen", "hetu": "150885-***X", "role": "5-Axis CNC Operator (Koneistaja)", "tes": "Teknologiateollisuus TVR 4", "rate": 34.50, "site": site_tampere.id, "sup": "Tapio Saarinen"},
        {"id": 102, "name": "Matti Virtanen", "hetu": "220391-***Y", "role": "MIG/MAG & TIG Welder (Hitsaaja)", "tes": "Teknologiateollisuus TVR 3", "rate": 32.00, "site": site_tampere.id, "sup": "Tapio Saarinen"},
        {"id": 103, "name": "Ville Korhonen", "hetu": "091188-***A", "role": "Industrial Electrician (Automaatioasentaja)", "tes": "Teknologiateollisuus TVR 5", "rate": 38.00, "site": site_tampere.id, "sup": "Tapio Saarinen"},
        {"id": 104, "name": "Antti Nieminen", "hetu": "140494-***B", "role": "Logistics & Forklift (Varastotyöntekijä)", "tes": "Teknologiateollisuus TVR 2", "rate": 28.50, "site": site_tampere.id, "sup": "Tapio Saarinen"},
        {"id": 105, "name": "Mikko Laine", "hetu": "030690-***C", "role": "Hydraulics Tech (Kunnossapitoasentaja)", "tes": "Teknologiateollisuus TVR 4", "rate": 35.00, "site": site_tampere.id, "sup": "Tapio Saarinen"},
        {"id": 106, "name": "Juha Koskinen", "hetu": "190287-***D", "role": "Foundry Tech (Valimotyöntekijä)", "tes": "Teknologiateollisuus TVR 3", "rate": 31.50, "site": site_jyvaskyla.id, "sup": "Esa Salminen"},
        {"id": 107, "name": "Pekka Heikkinen", "hetu": "270792-***E", "role": "Quality Inspector (NDT-Tarkastaja)", "tes": "Teknologiateollisuus TVR 5", "rate": 39.00, "site": site_jyvaskyla.id, "sup": "Esa Salminen"},
        {"id": 108, "name": "Timo Räsänen", "hetu": "110595-***F", "role": "Mechanical Assembler (Kokoonpanija)", "tes": "Teknologiateollisuus TVR 2", "rate": 29.00, "site": site_jyvaskyla.id, "sup": "Esa Salminen", "status": "SICK_LEAVE"}
    ]

    deployments = []
    for w in workers:
        dep = WorkerDeployment(
            worker_id=w["id"],
            worker_name=w["name"],
            worker_hetu_masked=w["hetu"],
            client_id=valmet.id,
            site_id=w["site"],
            role_title=w["role"],
            tes_category=w["tes"],
            client_charge_rate=w["rate"],
            supervisor_name=w["sup"],
            start_date=date(2026, 1, 15),
            status=w.get("status", "ACTIVE")
        )
        deployments.append(dep)
        db.add(dep)
    db.flush()

    # Shift records for today
    today = date.today()
    now = datetime.utcnow()
    morning_start = datetime(today.year, today.month, today.day, 7, 0, 0)

    # Active punches for workers 101, 102, 103, 104, 106, 107
    active_worker_ids = [101, 102, 103, 104, 106, 107]
    for wid in active_worker_ids:
        w_data = next(x for x in workers if x["id"] == wid)
        clock_in_time = morning_start + timedelta(minutes=int(wid % 15))
        
        # Biometric Log
        bio_log = BiometricLog(
            device_id="BIO-TMP-GATE-A" if w_data["site"] == site_tampere.id else "BIO-JYK-GATE-1",
            worker_id=wid,
            site_id=w_data["site"],
            timestamp=clock_in_time,
            direction="CLOCK_IN",
            verification_mode="FACIAL_SCAN",
            raw_payload=f'{{"status":"MATCH_OK","score":98.4,"terminal_gate":"TURNSTILE_01"}}'
        )
        db.add(bio_log)

        # Shift record
        shift = TimesheetShiftRecord(
            worker_id=wid,
            worker_name=w_data["name"],
            client_id=valmet.id,
            site_id=w_data["site"],
            shift_date=today,
            clock_in=clock_in_time,
            status="ON_DUTY",
            regular_hours=round((now - clock_in_time).total_seconds() / 3600.0, 2) if now > clock_in_time else 0.0,
            last_biometric_punch=clock_in_time
        )
        db.add(shift)

    # Worker 105: Clocked out after completing morning urgent overhaul (06:00 - 14:00)
    w105 = next(x for x in workers if x["id"] == 105)
    shift_w105 = TimesheetShiftRecord(
        worker_id=105,
        worker_name=w105["name"],
        client_id=valmet.id,
        site_id=w105["site"],
        shift_date=today,
        clock_in=datetime(today.year, today.month, today.day, 6, 0, 0),
        clock_out=datetime(today.year, today.month, today.day, 14, 30, 0),
        regular_hours=8.0,
        break_minutes=30,
        overtime_50_hours=0.5,
        status="CLOCKED_OUT",
        last_biometric_punch=datetime(today.year, today.month, today.day, 14, 30, 0)
    )
    db.add(shift_w105)

    # 4. Talent Acquisition Seeds (Job Requisitions, Candidate Shortlists, Interviews, Relocation)
    req1 = JobRequisition(
        req_code="REQ-2026-081",
        client_id=valmet.id,
        site_id=site_tampere.id,
        role_title="5-Axis CNC Machinist (Koneistaja)",
        tes_category="Teknologiateollisuus TVR 4",
        vacancies_count=2,
        fulfilled_count=1,
        experience_years_required=4,
        required_certifications="Työturvallisuuskortti",
        shift_pattern="2-vuorotyö (Day/Evening)",
        salary_range_eur_hr="20.50 - 24.00 €/h",
        start_date=today + timedelta(days=14),
        notes="Urgent replacement for Tampere turbine impeller milling cell. Heidenhain/Siemens 840D experience essential.",
        status="INTERVIEWING",
        created_at=datetime.utcnow() - timedelta(days=2)
    )
    req2 = JobRequisition(
        req_code="REQ-2026-079",
        client_id=valmet.id,
        site_id=site_tampere.id,
        role_title="MIG/MAG & TIG Welder (Hitsaaja)",
        tes_category="Teknologiateollisuus TVR 3",
        vacancies_count=3,
        fulfilled_count=1,
        experience_years_required=3,
        required_certifications="Työturvallisuuskortti, Tulityökortti",
        shift_pattern="Päivätyö (Day Shift)",
        salary_range_eur_hr="19.00 - 22.50 €/h",
        start_date=today + timedelta(days=21),
        notes="High-pressure pipe welding for boiler manufacture. Valid EN ISO 9606-1 stamp required.",
        status="IN_SOURCING",
        created_at=datetime.utcnow() - timedelta(days=4)
    )
    req3 = JobRequisition(
        req_code="REQ-2026-075",
        client_id=valmet.id,
        site_id=site_tampere.id,
        role_title="Industrial Electrician (Automaatioasentaja)",
        tes_category="Teknologiateollisuus TVR 5",
        vacancies_count=1,
        fulfilled_count=1,
        experience_years_required=5,
        required_certifications="Sähkötyöturvallisuus SFS 6002",
        shift_pattern="2-vuorotyö (Day/Evening)",
        salary_range_eur_hr="22.00 - 26.00 €/h",
        start_date=today + timedelta(days=7),
        notes="Automation line commissioning & robotic troubleshooting.",
        status="OFFER_ACCEPTED",
        created_at=datetime.utcnow() - timedelta(days=7)
    )
    req4 = JobRequisition(
        req_code="REQ-2026-070",
        client_id=valmet.id,
        site_id=site_jyvaskyla.id,
        role_title="Heavy Foundry Technician (Valimotyöntekijä)",
        tes_category="Teknologiateollisuus TVR 3",
        vacancies_count=2,
        fulfilled_count=2,
        experience_years_required=2,
        required_certifications="Työturvallisuuskortti",
        shift_pattern="3-vuorotyö (Continuous)",
        salary_range_eur_hr="19.50 - 21.00 €/h",
        start_date=today - timedelta(days=5),
        notes="Foundry floor molten metal molding and pour casting.",
        status="FULFILLED",
        created_at=datetime.utcnow() - timedelta(days=14)
    )
    db.add_all([req1, req2, req3, req4])
    db.flush()

    # Shortlisted Candidates for REQ-2026-081 (5-Axis CNC)
    cand1 = CandidateShortlist(
        requisition_id=req1.id,
        candidate_id=201,
        full_name="Marko Hakala",
        current_location="Tampere, Finland",
        nationality="Finnish",
        experience_years=7,
        match_percentage=95,
        tes_grade="Teknologiateollisuus TVR 4",
        certifications="Työturvallisuuskortti, Heidenhain iTNC 530 Certified",
        language_skills="Finnish Native, English Fluent",
        status="INTERVIEW_SCHEDULED",
        summary="Expert multi-axis operator with 7 years experience milling aerospace and turbine components to 5-micron tolerances."
    )
    cand2 = CandidateShortlist(
        requisition_id=req1.id,
        candidate_id=202,
        full_name="Ernesto Ramos",
        current_location="Manila, Philippines (Fast-Track Relocation)",
        nationality="Filipino",
        experience_years=6,
        match_percentage=91,
        tes_grade="Teknologiateollisuus TVR 4",
        certifications="Työturvallisuuskortti, Mastercam Certified",
        language_skills="English Fluent, Finnish A1 (In Training)",
        status="SHORTLISTED",
        summary="CAD/CAM programmer and precision machine operator with international certification. Migri specialist fast-track approved."
    )

    # Shortlisted Candidates for REQ-2026-079 (Welders)
    cand3 = CandidateShortlist(
        requisition_id=req2.id,
        candidate_id=203,
        full_name="Sami Kuusisto",
        current_location="Hämeenlinna, Finland",
        nationality="Finnish",
        experience_years=5,
        match_percentage=94,
        tes_grade="Teknologiateollisuus TVR 3",
        certifications="Työturvallisuuskortti, Tulityökortti, EN ISO 9606-1",
        language_skills="Finnish Native, English Good",
        status="SHORTLISTED",
        summary="Certified MIG/MAG pressure vessel welder with valid radiographic test stamps and robotic welding cell experience."
    )
    cand4 = CandidateShortlist(
        requisition_id=req2.id,
        candidate_id=204,
        full_name="Pradeep Sharma",
        current_location="Tampere, Finland (Relocated)",
        nationality="Indian",
        experience_years=4,
        match_percentage=88,
        tes_grade="Teknologiateollisuus TVR 3",
        certifications="Työturvallisuuskortti, ISO 9606-1 Stainless Steel",
        language_skills="English Fluent, Finnish A2",
        status="SHORTLISTED",
        summary="TIG welding specialist in exotic alloys and high-purity piping; arrived in Finland with active DVV/tax registration in progress."
    )

    # Candidate for REQ-2026-075 (Electrician)
    cand5 = CandidateShortlist(
        requisition_id=req3.id,
        candidate_id=205,
        full_name="Lassi Korpi",
        current_location="Nokia, Finland",
        nationality="Finnish",
        experience_years=8,
        match_percentage=97,
        tes_grade="Teknologiateollisuus TVR 5",
        certifications="Sähkötyöturvallisuus SFS 6002, Siemens TIA Portal",
        language_skills="Finnish Native, English Fluent",
        status="OFFER_ACCEPTED",
        summary="Senior automation technician with extensive Siemens PLC diagnostics and robotic cell installation experience."
    )
    db.add_all([cand1, cand2, cand3, cand4, cand5])
    db.flush()

    # Interview Slots
    slot1 = InterviewSlot(
        shortlist_id=cand1.id,
        candidate_name="Marko Hakala",
        role_title="5-Axis CNC Machinist (Koneistaja)",
        scheduled_at=datetime.utcnow() + timedelta(days=1, hours=2),
        meeting_link="https://teams.microsoft.com/l/meetup-join/valmet-interview-hakala",
        interviewer_name="Tapio Saarinen (Production Supervisor)",
        status="SCHEDULED",
        decision="PENDING"
    )
    slot2 = InterviewSlot(
        shortlist_id=cand3.id,
        candidate_name="Sami Kuusisto",
        role_title="MIG/MAG & TIG Welder (Hitsaaja)",
        scheduled_at=datetime.utcnow() + timedelta(days=2, hours=4),
        meeting_link="https://meet.google.com/suomi-staff-valmet-kuusisto",
        interviewer_name="Johanna Lehtonen (HR Director)",
        status="SCHEDULED",
        decision="PENDING"
    )
    db.add_all([slot1, slot2])

    # Relocation Milestones (International Recruits Tracking)
    relo1 = RelocationMilestone(
        candidate_id=202,
        candidate_name="Ernesto Ramos",
        role_title="5-Axis CNC Machinist (Koneistaja)",
        origin_country="Philippines",
        destination_city="Tampere",
        migri_permit_status="APPROVED",
        dvv_registered=True,
        tax_card_obtained=True,
        bank_account_opened=False,
        housing_arranged=True,
        target_arrival_date=today + timedelta(days=3),
        plant_start_date=today + timedelta(days=14),
        current_phase="ARRIVED"
    )
    relo2 = RelocationMilestone(
        candidate_id=204,
        candidate_name="Pradeep Sharma",
        role_title="MIG/MAG & TIG Welder (Hitsaaja)",
        origin_country="India",
        destination_city="Tampere",
        migri_permit_status="APPROVED",
        dvv_registered=False,
        tax_card_obtained=False,
        bank_account_opened=False,
        housing_arranged=True,
        target_arrival_date=today + timedelta(days=10),
        plant_start_date=today + timedelta(days=21),
        current_phase="FLIGHT_BOOKED"
    )
    db.add_all([relo1, relo2])

    db.commit()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed()
