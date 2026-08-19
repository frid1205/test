tolong buatkan test automation script untuk module custom benefit setting, format bisa cek pada payroll.spec.ts
terdapat test data juga untuk custom benefit ini.
untuk url bisa di akses di /custom-benefit-setting 
buatkan test custom benefit add dan edit, dengan nama "Benefit lain - lain"
sort order ke-5,
status active, 
description bisa isi lorem ipsum 500 karakter,
Klik tombol custom field kemudian isi  : 
 - Type field "Salary"
 - Label "Salary" (klo type field salary label, field type, dan default value disable)
 - Field Type "Currency"
 - Default Value "0"
 - Mandatory = true
 - Show On table = True
klik Tombol custom field kemudian isi :
 - Type field "Custom Field"
 - Label "Amount"
 - Field Type "Number"
 - Default Value "0"
 - Mandatory = true
 - Show On table = True
klik Tombol custom field kemudian isi :
 - Type field "Custom Field"
 - Label "Date"
 - Field Type "Date"
 - Default Value ""
 - Mandatory = false
 - Show On table = false
klik Tombol custom field kemudian isi :
 - Type field "Custom Field"
 - Label "Note"
 - Field Type "Text"
 - Default Value ""
 - Mandatory = false
 - Show On table = true

untuk formula nya adalah salary (bukan basic salary) * amount
klik tombol add untuk simpan.

untuk edit buka form edit, verifikasi custom field - custom field yang sudah ditambahkan tidak bisa diubah, formula pun tidak bisa diubah, yang bisa diubah hanya checkbox mandatory, checlbox show on table
untuk perubahan data 
name ubah menjadi "Benefit Others"
klik Tombol custom field kemudian isi :
 - Type field "Custom Field"
 - Label "Date"
 - Field Type "Date"
 - Default Value ""
 - Mandatory = true => ini yang diubah
 - Show On table = false

kemudian cek pada payroll - master kkp - benefit - tab "Benefit others" muncul atau tidak