package handler

import (
	"encoding/json"
	"net/http"
)

// Format response konsisten untuk semua endpoint:
// sukses -> {"success":true,"data":...}
// gagal  -> {"success":false,"error":{"message":"..."}}
type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

type APIError struct {
	Message string `json:"message"`
}

func JSON(w http.ResponseWriter, status int, v interface{}) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func OK(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, Envelope{Success: true, Data: data})
}

func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, Envelope{Success: true, Data: data})
}

func Err(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, Envelope{Success: false, Error: &APIError{Message: msg}})
}

func Decode(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}
