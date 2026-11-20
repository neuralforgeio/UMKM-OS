// FITUR 5 UMKM2Shell: PERKAKAS JARINGAN (net.go).
//
// Dari panel developer klasik kita ambil dua yang benar-benar
// dipakai mengoperasikan warung: ping TCP (apakah port Postgres
// di node salinan hidup?) dan tarik HTTP HEAD (apakah layanan
// luar menjawab?). Keduanya dengan timeout keras 5 detik —
// jangan sampai panel menggantung menunggu jaringan mati.
package shell

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PingTCP: coba sambung TCP host:port dalam 5 detik.
// Mengembalikan status + latensi milidetik.
func PingTCP(host, port string) (bool, float64, error) {
	alamat := net.JoinHostPort(host, port)
	mulai := time.Now()
	koneksi, err := net.DialTimeout("tcp", alamat, 5*time.Second)
	if err != nil {
		return false, 0, fmt.Errorf("sambungan gagal: %v", err)
	}
	latensi := float64(time.Since(mulai).Microseconds()) / 1000.0
	_ = koneksi.Close()
	return true, latensi, nil
}

// HttpHead: HEAD ke URL (atau GET bila HEAD ditolak) dengan
// client timeout 5 detik. Mengembalikan status + latensi.
// Redirect TIDAK diikuti (jangan biarkan panel dipakai sebagai
// proxy).
func HttpHead(alamatURL string) (int, float64, error) {
	if !strings.HasPrefix(alamatURL, "http://") && !strings.HasPrefix(alamatURL, "https://") {
		return 0, 0, fmt.Errorf("URL harus diawali http:// atau https://")
	}
	// skema & host harus terurai — tolak URL aneh sebelum menyentuh net
	u, err := url.Parse(alamatURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return 0, 0, fmt.Errorf("URL tidak terurai")
	}
	klien := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // jangan ikut redirect
		},
	}
	mulai := time.Now()
	res, err := klien.Head(alamatURL)
	if err != nil {
		// beberapa server menolak HEAD — coba GET ringan
		res2, err2 := klien.Get(alamatURL)
		if err2 != nil {
			return 0, 0, fmt.Errorf("permintaan gagal: %v", err)
		}
		defer res2.Body.Close()
		return res2.StatusCode, float64(time.Since(mulai).Microseconds()) / 1000.0, nil
	}
	defer res.Body.Close()
	return res.StatusCode, float64(time.Since(mulai).Microseconds()) / 1000.0, nil
}
