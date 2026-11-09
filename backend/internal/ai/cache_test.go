package ai

// Unittest cache jawaban + batas laju (port perilaku answer_cache.py /
// rate_limit.py): TTL, evict tertua, normalisasi kunci; sliding window
// dengan waktu tersuntik (tanpa sleep).

import (
        "strconv"
        "testing"
        "time"
)

func TestNormalizeQuestion(t *testing.T) {
        if NormalizeQuestion("Omzet hari ini?") != "omzet hari ini" {
                t.Errorf("NormalizeQuestion = %q", NormalizeQuestion("Omzet hari ini?"))
        }
        if NormalizeQuestion("  omzet   hari ini  ") != "omzet hari ini" {
                t.Errorf("spasi berulang harus dilipat: %q", NormalizeQuestion("  omzet   hari ini  "))
        }
        if NormalizeQuestion("stok!!") != "stok" {
                t.Errorf("tanda baca pinggir dibuang: %q", NormalizeQuestion("stok!!"))
        }
}

func TestAnswerCacheTTLDanKunci(t *testing.T) {
        c := NewAnswerCache(600, 256)
        dasar := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)

        c.Put(1, "3", "Omzet hari ini?", "Rp 100.000", dasar)
        if dapat := c.Get(1, "3", "omzet hari ini?", dasar.Add(599*time.Second)); dapat != "Rp 100.000" {
                t.Errorf("jawaban harus masih segar: %q", dapat)
        }
        if dapat := c.Get(1, "3", "omzet hari ini?", dasar.Add(601*time.Second)); dapat != "" {
                t.Errorf("jawaban kedaluwarsa harus kosong: %q", dapat)
        }
        // Kunci beda user/outlet/pertanyaan tidak saling menjawab.
        if dapat := c.Get(2, "3", "omzet hari ini?", dasar); dapat != "" {
                t.Errorf("user lain tidak boleh kena cache user 1: %q", dapat)
        }
        if dapat := c.Get(1, "4", "omzet hari ini?", dasar); dapat != "" {
                t.Errorf("outlet lain tidak boleh kena cache outlet 3: %q", dapat)
        }
        if dapat := c.Get(1, "3", "stok?", dasar); dapat != "" {
                t.Errorf("pertanyaan lain tidak boleh kena: %q", dapat)
        }
}

func TestAnswerCacheEvictTertua(t *testing.T) {
        c := NewAnswerCache(600, 3)
        dasar := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)
        for i := 0; i < 4; i++ {
                c.Put(1, "1", "t"+strconv.Itoa(i), "j"+strconv.Itoa(i), dasar.Add(time.Duration(i)*time.Minute))
        }
        // Entri tertua "t0" terlempar; sisanya hidup.
        if c.Get(1, "1", "t0", dasar.Add(3*time.Minute)) != "" {
                t.Error("entri tertua harus ter-evict saat penuh")
        }
        if c.Get(1, "1", "t3", dasar.Add(3*time.Minute)) != "j3" {
                t.Error("entri terbaru harus tetap hidup")
        }
}

func TestSlidingWindowLimiter(t *testing.T) {
        l := NewSlidingWindowLimiter(3, 3600)
        dasar := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)

        if !l.Allow("u", dasar) || !l.Allow("u", dasar.Add(time.Minute)) ||
                !l.Allow("u", dasar.Add(2*time.Minute)) {
                t.Fatal("tiga percobaan pertama harus diizinkan")
        }
        if l.Allow("u", dasar.Add(3*time.Minute)) {
                t.Error("percobaan keempat dalam jendela harus ditolak")
        }
        if sisa := l.Remaining("u", dasar.Add(3*time.Minute)); sisa != 0 {
                t.Errorf("sisa seharusnya 0: %d", sisa)
        }
        tunggu := l.RetryAfterSeconds("u", dasar.Add(3*time.Minute))
        // Hit tertua pada dasar+0; jendela 3600s -> bebas lagi di
        // dasar+3600, dicek pada dasar+180 -> sisa 3420 detik.
        if tunggu < 3419 || tunggu > 3421 {
                t.Errorf("retry-after seharusnya 3420 detik: %v", tunggu)
        }
        // Jendela bergeser: hitungan pertama keluar jendela setelah 1 jam.
        if !l.Allow("u", dasar.Add(3601*time.Second)) {
                t.Error("setelah jendela bergeser, slot harus bebas lagi")
        }
        // Kunci lain tidak terpengaruh.
        if !l.Allow("lain", dasar) {
                t.Error("kunci lain harus independen")
        }
}

func TestSlidingWindowLimiterGuard(t *testing.T) {
        // Nilai tak wajar dijepit ke batas aman — tidak pernah panic.
        l := NewSlidingWindowLimiter(0, 0)
        if !l.Allow("u", time.Now()) {
                t.Error("limit terjepit minimal 1 harus tetap mengizinkan")
        }
}
