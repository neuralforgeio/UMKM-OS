package schema

// Tes satu-sumber-kebenaran tabel: TabelSet HARUS menurunkan nama
// tabel dari teks Pernyataan (bukan daftar lepas) — pelajaran run-8:
// dump membawa tabel legacy _prisma_migrations yang tak punya CREATE
// di schema sehingga pemulihan ke node kosong gagal 42P01.

import "testing"

func TestTabelSetBerisiSeluruhTabelAplikasi(t *testing.T) {
	set := TabelSet()
	mau := []string{
		"users", "products", "transactions", "transaction_items",
		"stock_movements", "audit_logs", "product_images",
		"handover_events", "outlets", "chat_history", "dbheartbeat",
		// v2.2.0 Gerbang Developer: tiga tabel penyangga konsol.
		"sessions", "flags", "settings",
	}
	for _, n := range mau {
		if !set[n] {
			t.Errorf("tabel aplikasi %q tidak terdeteksi dari Pernyataan", n)
		}
	}
	if len(set) != len(mau) {
		t.Fatalf("jumlah tabel = %d, mau %d (ada nama liar?) %v", len(set), len(mau), set)
	}
}

func TestTabelSetMenolakTabelLegacy(t *testing.T) {
	set := TabelSet()
	if set["_prisma_migrations"] {
		t.Fatal("tabel legacy _prisma_migrations tidak boleh masuk set aplikasi")
	}
}
