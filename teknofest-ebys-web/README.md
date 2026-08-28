# KEYSİS — Kapsamlı Evrak Yönetim Sistemi

Elektronik Belge Yönetim Sistemi ve üzerine kurulu AI ajan katmanı: vatandaş
dilekçelerini sınıflandırır, mevzuatla ilişkilendirir, resmi yazı taslağı
üretir ve her adımda yetkili onayı bekler.

## Gereksinimler

Uygulama üç servise ihtiyaç duyar. Üçü de ayağa kalkmadan asistan ve arama
çalışmaz.

### 1. Qdrant (vektör veritabanı)

Varsayılan olarak uygulama, EVREN'in barındırdığı takıma özel Qdrant
örneğini kullanır — yerelde hiçbir şey çalıştırmanıza gerek yok. `.env.local`
içinde `QDRANT_API_KEY` (`qdr-teamNN-XXXXXXXX`, LLM anahtarından farklı) ve
`QDRANT_PREFIX` (takım numaranız, ör. `team07`) değerlerini doldurmanız
yeterli. Koleksiyonlar ilk kullanımda otomatik oluşturulur; her takım
yalnızca kendi koleksiyonlarını görür.

**Yerel Qdrant (opsiyonel — offline geliştirme/demo için):** `.env.local`
içinde `QDRANT_URL=http://localhost:6333` yapıp `QDRANT_API_KEY` ve
`QDRANT_PREFIX`'i boş bırakın, sonra:

Docker varsa:

```bash
docker compose up -d qdrant
```

**Docker olmadan (Windows):** Qdrant yerel bir çalıştırılabilir dosya olarak
da koşar. `qdrant-x86_64-pc-windows-msvc.zip` dosyasını
[releases sayfasından](https://github.com/qdrant/qdrant/releases) indirip
`.qdrant/` klasörüne açın, sonra:

```bash
npm run qdrant:dev
```

Verileri `.qdrant/storage` altında tutar; bu klasör sürüm kontrolüne
girmez. Windows binary'si Qdrant tarafından resmî olarak desteklenmez
ancak yerel geliştirme ve demo için sorunsuz çalışır. Yerel yolda
`http://localhost:6333/collections` yanıt vermelidir.

### 2. Docling servisi (belge ayrıştırma)

```bash
cd services/docling-service && pip install -r requirements.txt
```

```bash
npm run docling:dev
```

Bu servis yalnızca belge dönüştürme (OCR/parsing) yapar. Gömme vektörleri
artık burada değil, EVREN çıkarım servisinin `bge-m3-embed` modeliyle
üretiliyor (bkz. aşağıdaki `EVREN_API_KEY`) — yerelde model indirmeye
gerek yok.

**Başka bir makinede/sunucuda çalıştırmak:**

Docker ile (herhangi bir sunucuya taşınabilir):

```bash
cd services/docling-service
docker build -t docling-service .
docker run -p 8100:8100 -e DOCLING_SHARED_SECRET=<paylasilan-sir> docling-service
```

**Docker olmadan (Linux sunucu, systemd ile kalıcı servis):**

```bash
# Sunucuda:
sudo apt update && sudo apt install -y python3-venv libgl1 libglib2.0-0
sudo mkdir -p /opt/docling-service
# services/docling-service/ klasörünü (main.py, requirements.txt) buraya kopyalayın
cd /opt/docling-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

echo "DOCLING_SHARED_SECRET=<paylasilan-sir>" | sudo tee /opt/docling-service/.env

sudo useradd -r -s /usr/sbin/nologin docling  # zaten yoksa
sudo chown -R docling:docling /opt/docling-service

sudo cp docling-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now docling-service
sudo systemctl status docling-service
```

`docling-service.service` bu klasörde hazır (bkz.
[services/docling-service/docling-service.service](services/docling-service/docling-service.service))
— `/opt/docling-service` dışında bir yola kopyalarsanız dosyadaki yolları
güncelleyin. Sunucu yeniden başlasa bile `systemctl enable` sayesinde servis
otomatik ayağa kalkar; çökerse `Restart=on-failure` yeniden başlatır.

**Docker olmadan (Windows sunucu, NSSM ile kalıcı servis):**

```powershell
# Sunucuda, önce main.py + requirements.txt'yi kopyaladığınız klasörde:
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
winget install NSSM.NSSM    # veya: choco install nssm
```

`services/docling-service/install-windows-service.ps1` script'ini de aynı
klasöre kopyalayıp Administrator PowerShell'de çalıştırın:

```powershell
.\install-windows-service.ps1
```

Bu script NSSM servisini kurar, çalışma klasörünü ve log dosyalarını
ayarlar, 8100 portu için Windows Firewall kuralı ekler — ama servisi
başlatmaz. Script'in bastığı talimatları izleyin: önce
`setx DOCLING_SHARED_SECRET "..." /M` ile sır makine genelinde ayarlanır
(servisler ortam değişkenlerini başlarken okur), sonra `nssm start
DoclingService` ile başlatılır. Kaldırmak için:
`nssm stop DoclingService; nssm remove DoclingService confirm`.

Sadece hızlı bir test için (kalıcı olması gerekmiyorsa), Linux/macOS'ta
`--host 0.0.0.0` yeterli — ama terminal kapanınca süreç de kapanır:

```bash
uvicorn main:app --host 0.0.0.0 --port 8100
```

Dört yoldan hangisini seçerseniz seçin (Docker, systemd, NSSM, hızlı test),
servis artık localhost dışından erişilebilir olduğu için
`DOCLING_SHARED_SECRET`'i ayarlayın (rastgele bir dize) — aksi halde
`/convert` ucu, portu görebilen herkesten dosya kabul eder. Next.js
tarafında aynı değeri `.env.local`'de `DOCLING_SERVICE_URL` (servisin yeni
adresi) ile birlikte `DOCLING_SHARED_SECRET`'e yazın. Değer boşsa (yerel
geliştirmede olduğu gibi) kimlik doğrulama devre dışı kalır.

8100 portu ayrıca güvenlik duvarında/güvenlik grubunda açık olmalı (Linux:
`sudo ufw allow 8100/tcp`; Windows: `install-windows-service.ps1` bunu
otomatik ekler; bulutta ayrıca sağlayıcının güvenlik grubu ayarı da
gerekebilir) — aksi halde Next.js uygulaması servise hiç ulaşamaz.

### 3. Next.js uygulaması

```bash
cp .env.example .env.local
```

`EVREN_API_KEY` ve `SESSION_SECRET` değerlerini doldurun, sonra:

```bash
npm install && npm run db:push && npm run db:seed && npm run dev
```

## Mimari notlar

- **Kaynak doğruluğu**: SQLite metin ve üstverinin tek doğruluk kaynağıdır;
  Qdrant yalnızca arama indeksidir. Bir kayıt silindiğinde ikisinden de
  silinir.
- **Üç ayrı vektör koleksiyonu**: kurum bilgi tabanı, mevzuat külliyatı ve
  sohbet ekleri. Sohbet ekleri ayrı koleksiyonda tutulur; bir sohbete
  yüklenen belge kurum geneli aramalarda ASLA görünmez.
- **Çok kurumluluk**: her sorgu `kurumId` ile sınırlıdır ve sohbetler ayrıca
  `kullaniciId` ile — bir kimlik istemciden geldiğinde tek başına yeterli
  değildir, sahiplik her okumada yeniden doğrulanır.
- **HITL**: asistan yalnızca öneri üretir. Sınıflandırma onayı, yazı önerisi
  kabulü ve onay zinciri yalnızca yetkili kullanıcının arayüzden yapabileceği
  işlemlerdir; hiçbir araç bunları kullanıcı adına gerçekleştiremez.
