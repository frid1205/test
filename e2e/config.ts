// Konfigurasi tunggal untuk E2E suite.
// Cukup ubah nilai di file ini untuk pindah environment (local <-> server).

//dev
export const API_BASE_URL = "https://telkomcel-s1.lumoshive.net/api"; // backend Laravel
export const UI_BASE_URL = "https://telkomcel-s1.lumoshive.net"; // frontend Vite

//sbx
//export const API_BASE_URL = "https://telkomcel-s1-sbx.lumoshive.net"; 
//export const UI_BASE_URL = "https://telkomcel-s1-sbx.lumoshive.net";

//staging
//export const API_BASE_URL = "https://telkomcel.lumoshive.net/api"; // backend Laravel
//export const UI_BASE_URL = "https://telkomcel.lumoshive.net"; // frontend Vite

// export const API_BASE_URL = "http://127.0.0.1:8080"; // backend Laravel
// export const UI_BASE_URL = "http://localhost:5173"; // frontend Vite

// true  = hapus data payroll RIMBUN SIBURIAN sebelum test (agar test idempotent)
// false = biarkan data yang sudah ada (berguna saat ingin test data existing)
export const CLEANUP_BEFORE_TEST = true;
