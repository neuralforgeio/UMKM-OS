package ai

// Cache jawaban asisten (port ml-service v3.1.0) — blueprint BAB 9.3.
//
// Mitigasi biaya kedua: pemilik warung bertanya hal yang SAMA berulang
// ("berapa omzet hari ini?" setiap pagi). Kunci = user + outlet +
// pertanyaan ternormalisasi; TTL default 600 detik (env
// ASSISTANT_CACHE_SECONDS) — cukup segar untuk angka harian, cukup lama
// untuk menghemat token. Hanya jawaban BER-ANGKA TERVERIFIKASI yang
// di-cache: hasil halusinasi bertanda tidak pernah dibekukan.
//
// Batas entri (256, buang-yang-tertua) menjaga memori container kecil —
// ini cache proses, bukan database.

import (
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"
)

var lipatSpasiRe = regexp.MustCompile(`\s+`)

// NormalizeQuestion menyamakan bentuk pertanyaan sebelum jadi kunci
// cache: lowercase, spasi berulang dilipat, tanda baca pinggir dibuang —
// "Omzet hari ini?" dan "  omzet hari ini  " mengenai entri sama.
func NormalizeQuestion(question string) string {
	s := strings.TrimSpace(strings.ToLower(question))
	s = lipatSpasiRe.ReplaceAllString(s, " ")
	return strings.Trim(s, " ?!.,")
}

type cacheEntry struct {
	simpan  time.Time
	jawaban string
}

// AnswerCache: cache proses-in-memory dengan TTL + jumlah entri terbatas.
type AnswerCache struct {
	mu         sync.Mutex
	ttl        time.Duration
	maxEntries int
	data       map[string]cacheEntry
}

func NewAnswerCache(ttlSeconds int, maxEntries int) *AnswerCache {
	if ttlSeconds < 1 {
		ttlSeconds = 600
	}
	if maxEntries < 1 {
		maxEntries = 256
	}
	return &AnswerCache{
		ttl:        time.Duration(ttlSeconds) * time.Second,
		maxEntries: maxEntries,
		data:       make(map[string]cacheEntry),
	}
}

func (c *AnswerCache) key(userID int64, outletID string, question string) string {
	return fmt.Sprintf("%d|%s|%s", userID, outletID, NormalizeQuestion(question))
}

// Get: jawaban ter-cache yang masih segar, atau "" (tanpa bool —
// jawaban kosong tidak pernah di-cache sehingga "" = tidak ada).
func (c *AnswerCache) Get(userID int64, outletID string, question string, now time.Time) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	entri, ada := c.data[c.key(userID, outletID, question)]
	if !ada {
		return ""
	}
	if now.Sub(entri.simpan) > c.ttl {
		return ""
	}
	return entri.jawaban
}

// Put menyimpan jawaban; lempar entri tertua bila penuh.
func (c *AnswerCache) Put(userID int64, outletID string, question string, answer string, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	kunci := c.key(userID, outletID, question)
	if len(c.data) >= c.maxEntries {
		if _, ada := c.data[kunci]; !ada {
			tertua := ""
			var terlama time.Time
			first := true
			for k, v := range c.data {
				if first || v.simpan.Before(terlama) {
					tertua = k
					terlama = v.simpan
					first = false
				}
			}
			if tertua != "" {
				delete(c.data, tertua)
			}
		}
	}
	c.data[kunci] = cacheEntry{simpan: now, jawaban: answer}
}

// Clear mengosongkan seluruh cache (dipakai unittest).
func (c *AnswerCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = make(map[string]cacheEntry)
}
