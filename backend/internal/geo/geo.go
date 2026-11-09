package geo

// Geo lookup IP untuk jejak audit (era Go murni) — memperkaya baris
// audit_log dengan kota/negara asal IP aktor via ip-api.com (gratis,
// tanpa kunci, 45 permintaan/menit). Hasun disimpan di cache proses
// (TTL 1 jam) supaya satu halaman audit tidak membakar kuota layanan;
// lookup GAGAL TIDAK PERNAH menjatuhkan request audit — kolom geo
// hanya kosong.
//
// IP privat (10.x, 192.168.x, 127.x, ::1, 172.16-31.x) langsung
// dijawab "jaringan lokal" tanpa trafik keluar — laptop warung tidak
// pernah menunggu timeout untuk IP-nya sendiri.

import (
        "context"
        "encoding/json"
        "net"
        "net/http"
        "strings"
        "sync"
        "time"
)

type Hasil struct {
        Kota    string `json:"kota"`
        Negara  string `json:"negara"`
        Lokal   bool   `json:"lokal"`
}

type cacheEntry struct {
        hasil Hasil
        simpan time.Time
}

var (
        mu    sync.Mutex
        cache = map[string]cacheEntry{}
        klien = &http.Client{Timeout: 3 * time.Second}
)

const ttl = time.Hour

// privat memeriksa apakah IP adalah alamat jaringan lokal
// (RFC1918 + loopback + link-local — cukup untuk konteks warung).
func privat(ip string) bool {
        alamat := net.ParseIP(strings.TrimSpace(ip))
        if alamat == nil {
                return false
        }
        return alamat.IsLoopback() || alamat.IsLinkLocalUnicast() || alamat.IsPrivate()
}

// Lookup mengembalikan kota/negara untuk satu IP (cache proses,
// TTL 1 jam). Dipakai handler audit; unittest menguji jalur privat +
// cache + server HTTP uji (lihat geo_test.go).
func Lookup(ip string) Hasil {
        ctx, cancel := context.WithTimeout(context.Background(), 3500*time.Millisecond)
        defer cancel()
        return LookupContext(ctx, ip)
}

// LookupContext: varian dengan context — dipakai handler audit supaya
// ikut membatalkan saat klien menutup koneksi.
func LookupContext(ctx context.Context, ip string) Hasil {
        ip = strings.TrimSpace(ip)
        if ip == "" {
                return Hasil{}
        }
        mu.Lock()
        if entri, ada := cache[ip]; ada && time.Since(entri.simpan) < ttl {
                mu.Unlock()
                return entri.hasil
        }
        mu.Unlock()

        if privat(ip) {
                hasil := Hasil{Kota: "jaringan lokal", Negara: "-", Lokal: true}
                simpan(ip, hasil)
                return hasil
        }

        // Batasi panjang supaya IP aneh tidak menuntun URL nyeleneh.
        if len(ip) > 45 {
                return Hasil{}
        }

        req, err := http.NewRequestWithContext(ctx, http.MethodGet,
                "http://ip-api.com/json/"+ip+"?fields=status,country,city", nil)
        if err != nil {
                return Hasil{}
        }
        res, err := klien.Do(req)
        if err != nil {
                return Hasil{} // gagal = geo kosong, audit tetap jalan
        }
        defer res.Body.Close()
        if res.StatusCode != http.StatusOK {
                return Hasil{}
        }
        var isi struct {
                Status  string `json:"status"`
                Country string `json:"country"`
                City    string `json:"city"`
        }
        if err := json.NewDecoder(res.Body).Decode(&isi); err != nil || isi.Status != "success" {
                return Hasil{}
        }
        hasil := Hasil{Kota: isi.City, Negara: isi.Country}
        simpan(ip, hasil)
        return hasil
}

func simpan(ip string, hasil Hasil) {
        mu.Lock()
        cache[ip] = cacheEntry{hasil: hasil, simpan: time.Now()}
        mu.Unlock()
}

// BersihkanCache mengosongkan cache (unittest).
func BersihkanCache() {
        mu.Lock()
        cache = map[string]cacheEntry{}
        mu.Unlock()
}
