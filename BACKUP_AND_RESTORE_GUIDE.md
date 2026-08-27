# MongoDB Backup & Restore Guide

Ye document Dukan Khata ke database backups ko manage karne, download karne aur unhe locally ya live server (Atlas) par restore karne ka mukammal tareeqa batata hai.

## 1. Daily Backup Ka Setup (Automated)

Aapke project mein pehle se ek GitHub Actions CI/CD pipeline setup hai jo daily basis par MongoDB ka backup leti hai.
- **Workflow File:** `.github/workflows/daily-backup.yml`
- **Kaam kese karta hai:** Har raat midnight ko, yeh script `mongodump` command run karti hai aur aapke database (Prod aur Dev) ka pura snapshot `.gz` format mein banati hai.
- **Save kahan hota hai:** Yeh backup files aapki ek private GitHub repository (`dukaankhata-db-backup`) mein automatic push ho jati hain.

---

## 2. Backup Download Karne Ka Tareeqa

1. Apne GitHub account par jayen.
2. `dukaankhata-db-backup` wali repository open karein.
3. Wahan `prod` ya `dev` folder mein jayen.
4. Jis date ka backup chahiye (e.g., `prod-2026-08-27.gz`), us par click karke download kar lein.

*(Note: Kabhi kabhi browser `.gz` file ko automatically unzip kar deta hai aur file ka naam sirf `prod-2026-08-27` reh jata hai. Ye bilkul normal hai.)*

---

## 3. Restore Karne Ke Mukhtalif Tareeqe

Restore karne ke liye aapke system mein **MongoDB Database Tools** (khaas tor par `mongorestore`) install hona zaroori hai.

### Tareeqa A: Localhost (Apne PC) Par Restore Karna
Agar aap chahte hain ke cloud ka data aapke laptop/PC par aa jaye taake aap testing kar sakein:

**Terminal/PowerShell mein ye command chalayein:**
```powershell
mongorestore --gzip --archive="C:\path\to\your\downloaded\backup.gz" --uri="mongodb://localhost:27017/" --nsFrom="dukaankhata-dev.*" --nsTo="dukaankhata_local_test.*"
```
*(Ye command cloud wale data ko aapke local pc par `dukaankhata_local_test` naam ke database mein dal degi).*

### Tareeqa B: Atlas Ke Andar Same Database Mein Restore Karna
Agar kisi wajah se data delete ho gaya hai aur aap original database ko dobara backup se wapis lana chahte hain:

```powershell
mongorestore --gzip --archive="C:\path\to\your\downloaded\backup.gz" --uri="mongodb+srv://<username>:<password>@<your-cluster>.mongodb.net/"
```
*(Ye command original database (e.g. `dukaankhata-dev`) mein missing records ko add kar degi. Agar aap chahte hain ke purana data bilkul wipe out (delete) ho kar naya aaye toh command mein `--drop` add kar dein).*

### Tareeqa C: Atlas Ke Andar Ek Naye Database (jaise DB-Backup) Mein Restore Karna
Agar aap cloud (Atlas) par hi test karna chahte hain bina original data ko chede, toh ek naya database naam use karein:

```powershell
mongorestore --gzip --archive="C:\path\to\your\downloaded\backup.gz" --uri="mongodb+srv://<username>:<password>@<your-cluster>.mongodb.net/" --nsFrom="dukaankhata-dev.*" --nsTo="DB-Backup.*"
```
*(Ye command original `dukaankhata-dev` database ke data ko `DB-Backup` naam ke ek bilkul naye database mein daal degi).*

---

## 4. Troubleshooting (Gzip Error)

Agar aap `mongorestore` command run karein aur ye error aaye:
`Failed: gzip: invalid header`

**Wajah:** Iska matlab hai aapke browser ne file download karte waqt usko auto-unzip/extract kar diya tha.

**Solution:** Command mein se `--gzip` hata dein aur extract hui file ka path dein:
```powershell
mongorestore --archive="C:\path\to\extracted\file" --uri="..."
```

---

## 5. Zaroori Hidayat
- Agar powershell mein `mongorestore` not recognized ka error aaye, toh seedha absolute path use karein:
  `& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe"`
- Restore karne ke baad hamesha **MongoDB Compass** open karein, database refresh karein aur check karein ke documents properly aagaye hain ya nahi.

