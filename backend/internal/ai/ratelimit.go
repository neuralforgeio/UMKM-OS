package ai

// Batas laju per pengguna (port ml-service v3.1.0) — blueprint BAB 5.4
// & 9.3. Mitigasi biaya LLM utama: sliding window per user_id. Default
// 12 pesan per jam (env ASSISTANT_RATE_LIMIT_PER_HOUR) — cukup untuk
// pemilik yang penasaran, cukup sempit untuk menghentikan skrip yang
// lupa diralat. Jendela digeser per detik (bukan ditambah-flat tiap
// jam) sehingga pemilik tidak pernah menunggu "jam berikutnya" penuh.

import (
	"sync"
	"time"
)

// SlidingWindowLimiter: penghitung kejadian dalam jendela waktu yang
// bergeser. Murni dan dapat disuntik waktu supaya unittest bisa
// melompat waktu tanpa sleep. Aman dipakai lintas goroutine (mutex).
type SlidingWindowLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string][]time.Time
}

func NewSlidingWindowLimiter(limit int, windowSeconds float64) *SlidingWindowLimiter {
	if limit < 1 {
		limit = 1
	}
	if windowSeconds <= 0 {
		windowSeconds = 3600
	}
	return &SlidingWindowLimiter{
		limit:  limit,
		window: time.Duration(windowSeconds * float64(time.Second)),
		hits:   make(map[string][]time.Time),
	}
}

func (l *SlidingWindowLimiter) prune(key string, now time.Time) []time.Time {
	tumpukan := l.hits[key]
	batas := now.Add(-l.window)
	drop := 0
	for drop < len(tumpukan) && !tumpukan[drop].After(batas) {
		drop++
	}
	if drop > 0 {
		tumpukan = append([]time.Time{}, tumpukan[drop:]...)
		l.hits[key] = tumpukan
	}
	return tumpukan
}

// Allow mencatat satu percobaan; true bila masih di bawah limit.
func (l *SlidingWindowLimiter) Allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	tumpukan := l.prune(key, now)
	if len(tumpukan) >= l.limit {
		return false
	}
	l.hits[key] = append(tumpukan, now)
	return true
}

// RetryAfterSeconds: berapa detik lagi slot bebas (header Retry-After).
func (l *SlidingWindowLimiter) RetryAfterSeconds(key string, now time.Time) float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	tumpukan := l.prune(key, now)
	if len(tumpukan) < l.limit {
		return 0
	}
	sisa := tumpukan[0].Add(l.window).Sub(now).Seconds()
	if sisa < 0 {
		return 0
	}
	return sisa
}

// Remaining: sisa permintaan dalam jendela (observability).
func (l *SlidingWindowLimiter) Remaining(key string, now time.Time) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	sisa := l.limit - len(l.prune(key, now))
	if sisa < 0 {
		return 0
	}
	return sisa
}
