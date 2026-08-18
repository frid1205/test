-- =============================================================================
-- cleardata.sql — Query TRUNCATE/DELETE data uji payroll (PostgreSQL)
-- -----------------------------------------------------------------------------
-- Dijalankan oleh global-setup saat CLEANUP_MODE = "sql" dan CLEANUP_BEFORE_TEST = true.
-- Hapus SEMUA data pada tabel payroll di bawah, lalu reset sequence id.
--
-- Catatan:
--  * medical & pulsa satu tabel (master_all_benefit_and_others) — kolom payment.
--  * CASCADE dipakai karena payroll_report_employees/components mereferensikan
--    payroll_reports (tabel anak ikut ter-truncate, tidak ada data yang menanti).
--  * custom benefit & custom deduction TIDAK di-truncate; hanya yang
--    is_system = false di-DELETE (entries ikut terhapus via ON DELETE CASCADE).
-- =============================================================================

TRUNCATE TABLE
  master_reguler_thp,                                   -- daftar gaji
  master_benefit_districts,                             -- benefit district
  master_benefit_overtimes,                             -- overtime
  master_all_benefit_and_others,                        -- medical + pulsa
  non_regular_salary_bfkj,                              -- non reguler BFKJ
  non_regular_salary_hometrip,                          -- non reguler hometrip
  non_regular_salary_annual_leave_allowance,            -- CUTAH
  non_regular_salary_13th_month_salary,                 -- gaji ke-13
  non_regular_salary_competency_allowance,              -- tunjangan kompetensi
  master_salary_deduction_homestaff,                    -- homestaff deduction
  master_salary_deduction_expat_local,                  -- expat local deduction
  master_prorate_others,                                -- other prorate
  master_prorate,                                       -- prorate
  deduction_transfer,                                   -- deduction transfer
  payroll_report_components,                            -- anak payroll_report_employees
  payroll_report_employees,                             -- anak payroll_reports
  payroll_reports,                                      -- report KKP
  moju_components,                                      -- komponen jurnal memo
  master_moju,                                          -- jurnal memo
  payment_receipt_notes,                                -- rekap bayar
  payroll_detail_components,                            -- anak payroll_details
  payroll_details,                                      -- anak payrolls
  payrolls                                             -- payslip / generate payroll
  RESTART IDENTITY
  CASCADE;


-- Custom benefit: hapus hanya buatan user (is_system = false).
-- custom_benefit_entries & custom_benefit_fields ikut terhapus (FK ON DELETE CASCADE).
DELETE from custom_benefit_entries where custom_benefit_id in (select id from custom_benefits where is_system= false);      
DELETE from custom_benefit_fields where custom_benefit_id in (select id from custom_benefits where is_system= false);      
DELETE from custom_benefits where is_system = false;

-- Custom deduction: delete entries lalu master (jangan truncate).
DELETE from custom_deduction_entries where custom_deduction_id in (select id from custom_deductions where is_system = false);
DELETE from custom_deductions where is_system = false;