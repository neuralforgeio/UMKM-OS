package ai

// Orkestrator generasi jawaban (port ml-service v3.6.0):
// LLM -> validasi angka (KHUSUS maksud bisnis warung) -> retry 1x -> flag.
//
// Era "AI Bebas": validasi angka HANYA dijalankan bila maksud
// pertanyaan masuk MaxudBerdata — angka pada jawaban pertanyaan bebas
// (hitungan/pengetahuan umum) bukan klaim data warung sehingga tidak
// diadukan ke DATA. Angka halusinasi yang bertahan setelah retry pada
// pertanyaan bisnis TIDAK dibuang — ditandai (frontend menampilkan
// peringatan).

import "context"

// ModeAiNonaktif: LLM tidak tersedia — jalur chat menolak jujur
// (HTTP 503) alih-alih memalsukan jawaban template (keputusan pemilik:
// asisten memakai AI penyedia (Groq) saja).
type ModeAiNonaktif struct{ msg string }

func (e *ModeAiNonaktif) Error() string { return e.msg }

// HasilGenerasi: hasil alur generasi untuk respons endpoint.
type HasilGenerasi struct {
	Answer           string `json:"answer"`
	Mode             string `json:"mode"`
	Intent           string `json:"intent"`
	Period           string `json:"period"`
	NumbersValidated bool   `json:"numbers_validated"`
	Retried          bool   `json:"retried"`
}

// GenerateAnswer menjalankan alur blueprint. Klien nil => ModeAiNonaktif.
func GenerateAnswer(ctx context.Context, question string, data *DataContext, history []Pesan, klien Client) (*HasilGenerasi, error) {
	intent := ClassifyIntent(question)
	period := ExtractPeriod(question)

	if klien == nil {
		return nil, &ModeAiNonaktif{msg: "Mode AI tidak aktif: OSCAR hanya " +
			"menjawab lewat AI (Groq). Periksa Pengaturan -> Asisten AI lalu " +
			"coba lagi."}
	}

	allowed := CollectAllowedNumbers(data)
	messages := BuildMessages(data, history, question)
	answer, err := klien.Complete(ctx, messages, Temperature, MaxTokens)
	if err != nil {
		return nil, err
	}

	// Validasi angka hanya untuk pertanyaan BISNIS WARUNG.
	sah := true
	retried := false
	if MaxudBerdata[intent] {
		var pelanggar []float64
		sah, pelanggar = ValidateNumbers(answer, allowed)
		if !sah {
			retried = true
			koreksi := append(append([]Pesan{}, messages...),
				Pesan{Role: "assistant", Content: answer},
				Pesan{Role: "user", Content: BuildRetryInstruction(pelanggar)},
			)
			answer, err = klien.Complete(ctx, koreksi, Temperature, MaxTokens)
			if err != nil {
				return nil, err
			}
			sah, _ = ValidateNumbers(answer, allowed)
		}
	}

	return &HasilGenerasi{
		Answer:           answer,
		Mode:             "ai",
		Intent:           intent,
		Period:           period,
		NumbersValidated: sah,
		Retried:          retried,
	}, nil
}
