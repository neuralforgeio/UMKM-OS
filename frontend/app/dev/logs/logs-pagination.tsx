"use client";

// Pagination berbasis URL untuk /dev/logs (Task 34, Fase B).
// TablePagination yang ada berbasis callback setState (halaman produk);
// log butuh nomor halaman HIDUP DI URL supaya hasil query bisa
// dibookmark/dibagikan dan tombol back browser berperilaku wajar.
// Komponen tipis ini hanya menerjemahkan callback => router.push.
import { useRouter } from "next/navigation";
import { TablePagination } from "@/components/table-pagination";

export function LogsPagination({
  page,
  pageCount,
  pageSize,
  total,
  basePath,
  queryString,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  basePath: string;
  // Query string filter AKTIF saat ini (tanpa "page") — dipertahankan
  // saat berpindah halaman, jadi filter tidak hilang di halaman 2.
  queryString: string;
}) {
  const router = useRouter();

  return (
    <TablePagination
      page={page}
      pageCount={pageCount}
      pageSize={pageSize}
      total={total}
      unit="log"
      onPage={(next) => {
        const joiner = queryString ? `${queryString}&` : "?";
        router.push(`${basePath}${joiner}page=${next}`);
      }}
    />
  );
}
