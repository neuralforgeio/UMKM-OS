"""Batas laju per pengguna (ml-service v3.1.0) — blueprint BAB 5.4 & 9.3.

Mitigasi biaya LLM utama: sliding window per `user_id`. Default 12
pesan per jam (env ASSISTANT_RATE_LIMIT_PER_HOUR) — cukup untuk pemilik
yang penasaran, cukup sempit untuk menghentikan skrip yang lupa
diralat. Jendela digeser per detik (bukan ditambah-flat tiap jam)
sehingga pemilik tidak pernah menunggu "jam berikutnya" penuh.
"""

from __future__ import annotations

from collections import deque


class SlidingWindowLimiter:
    """Penghitung kejadian dalam jendela waktu yang bergeser.

    Murni dan dapat di-inject waktu (argumen `now`) supaya test bisa
    melompat waktu tanpa sleep. Aman dipakai lintas await karena satu
    event loop FastAPI mengeksekusi kode sinkron tanpa preemption.
    """

    def __init__(self, limit: int, window_seconds: float = 3600.0) -> None:
        if limit < 1:
            raise ValueError("limit harus >= 1")
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def _prune(self, key: str, now: float) -> deque[float]:
        tumpukan = self._hits.setdefault(key, deque())
        batas = now - self.window_seconds
        while tumpukan and tumpukan[0] <= batas:
            tumpukan.popleft()
        return tumpukan

    def allow(self, key: str, now: float | None = None) -> bool:
        """Catat satu percobaan; True bila masih di bawah limit."""
        import time

        waktu = time.time() if now is None else now
        tumpukan = self._prune(key, waktu)
        if len(tumpukan) >= self.limit:
            return False
        tumpukan.append(waktu)
        return True

    def retry_after_seconds(self, key: str, now: float | None = None) -> float:
        """Berapa detik lagi slot bebas (untuk header Retry-After)."""
        import time

        waktu = time.time() if now is None else now
        tumpukan = self._prune(key, waktu)
        if len(tumpukan) < self.limit:
            return 0.0
        tertua = tumpukan[0]
        return max(0.0, tertua + self.window_seconds - waktu)

    def remaining(self, key: str, now: float | None = None) -> int:
        """Sisa permintaan dalam jendela (untuk status/observability)."""
        import time

        waktu = time.time() if now is None else now
        return max(0, self.limit - len(self._prune(key, waktu)))
