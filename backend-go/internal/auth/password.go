package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword menghasilkan hash bcrypt dari password plain.
func HashPassword(plain string) (string, error) {
    b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
    return string(b), err
}

// CheckPassword membandingkan password plain dengan hash di database.
func CheckPassword(hash, plain string) bool {
    return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}
