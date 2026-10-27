"""Cache jawaban asisten (ml-service v3.1.0) — blueprint BAB 9.3.

Mitigasi biaya kedua: pemilik warung bertanya hal yang SAMA berulang
("berapa omzet hari ini?" setiap pagi). Kunci = user + outlet +
pertanyaan ternormalisasi; TTL default 600 detik (env
ASSISTANT_CACHE_SECONDS) — cukup segar untuk angka harian, cukup lama
untuk menghemat token. Hanya jawaban BER-ANGKA TERVERIFIKASI yang
di-cache: hasil halusinasi bertanda tidak pernah dibekukan.

Batas entri (256, LRU-ringan via buang-yang-tertua) menjaga memori
container kecil — ini cache proses, bukan database.
"""

from __future__ import annotations

import re
import time


def normalize_question(question: str) -> str:
    """Samakan bentuk pertanyaan sebelum jadi kunci cache.

    lowercase, spasi berulang dilipat, tanda baca pinggir dibuang —
    "Omzet hari ini?" dan "  omzet hari ini  " mengenai entri sama.
    """
    s = question.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.strip(" ?!.,")
    return s


class AnswerCache:
    """Cache proses-in-memory dengan TTL + jumlah entri terbatas."""

    def __init__(self, ttl_seconds: float = 600.0, max_entries: int = 256) -> None:
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds harus > 0")
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._data: dict[str, tuple[float, str]] = {}

    def _key(self, user_id: int, outlet_id: str, question: str) -> str:
        return f"{user_id}|{outlet_id}|{normalize_question(question)}"

    def get(self, user_id: int, outlet_id: str, question: str,
            now: float | None = None) -> str | None:
        """Jawaban ter-cache yang masih segar, atau None."""
        waktu = time.time() if now is None else now
        entri = self._data.get(self._key(user_id, outlet_id, question))
        if entri is None:
            return None
        tersimpan, jawaban = entri
        if waktu - tersimpan > self.ttl_seconds:
            return None
        return jawaban

    def put(self, user_id: int, outlet_id: str, question: str,
            answer: str, now: float | None = None) -> None:
        """Simpan jawaban; lempar entri tertua bila penuh."""
        waktu = time.time() if now is None else now
        kunci = self._key(user_id, outlet_id, question)
        if len(self._data) >= self.max_entries and kunci not in self._data:
            tertua = min(self._data, key=lambda k: self._data[k][0])
            del self._data[tertua]
        self._data[kunci] = (waktu, answer)

    def clear(self) -> None:
        """Kosongkan seluruh cache (dipakai test)."""
        self._data.clear()
