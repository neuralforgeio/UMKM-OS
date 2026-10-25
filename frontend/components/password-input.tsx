"use client";

// Input password + toggle lihat/sembunyi + checklist syarat hidup
// (Task 35). Dipakai di form akun developer (buat akun, reset password)
// dan Akun Saya. Checklist berubah hijau SAAT MENGETIK, bukan setelah
// submit — pengelola langsung tahu syarat mana yang sudah dipenuhi.
// v1.5.0: styling kini sadar-tema — di konsol gelap (wrapper .dark)
// input mengikuti bahasa desain glass (bg slate gelap, teks terang,
// focus biru), sehingga teks yang diketik selalu terbaca.
import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password-policy";

const INPUT_BASE =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20";

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  autoComplete = "off",
  showChecklist = false,
}: {
  id?: string;
  // v1.0.3: atribut name formulir — dipakai form Akun Saya yang mengirim
  // FormData lewat server action (form lama memakai state terkontrol,
  // prop ini tetap opsional supaya tidak merusak pemanggilan lama).
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  // true = render baris checklist di bawah input (hijau = terpenuhi).
  showChecklist?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
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
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
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
                  ok
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400 dark:text-slate-500"
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
