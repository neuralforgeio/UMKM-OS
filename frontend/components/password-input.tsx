"use client";

// Input password + toggle lihat/sembunyi + checklist syarat hidup
// (Task 35). Dipakai di form akun developer (buat akun, reset password)
// dan siap dipakai Fase C (Akun Saya). Checklist berubah hijau SAAT
// MENGETIK, bukan setelah submit — pengelola langsung tahu syarat mana
// yang sudah dipenuhi.
import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password-policy";

const INPUT_BASE =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100";

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = "off",
  showChecklist = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  // true = render 3 baris checklist di bawah input (hijau = terpenuhi).
  showChecklist?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          // password -> text dan sebaliknya: nilai yang sama, tipe saja
          // yang berganti, jadi state tidak pernah hilang saat toggle.
          type={visible ? "text" : "password"}
          className={INPUT_BASE}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={72}
          autoComplete={autoComplete}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Sembunyikan password" : "Lihat password"}
          title={visible ? "Sembunyikan password" : "Lihat password"}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      {showChecklist && (
        <ul className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(value);
            return (
              <li
                key={rule.key}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                  ok ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {ok ? (
                  <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
                ) : (
                  <X className="h-3 w-3 shrink-0" strokeWidth={3} />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
