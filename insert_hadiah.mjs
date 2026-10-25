import { neon } from '@neondatabase/serverless';

// Masukkan connection string Neon kamu atau baca dari env
const sql = neon(process.env.DATABASE_URL);

async function tambahHadiah(idHadiah, apiKey, kuota = 2) {
    try {
        await sql`
            INSERT INTO klaim_hadiah (id_hadiah, api_key_text, current_views, max_views)
            VALUES (${idHadiah}, ${apiKey}, 0, ${kuota})
        `;
        console.log(`Hadiah berhasil dibuat! Link: https://wa-automation-rho.vercel.app/api/claim?id=${idHadiah}`);
    } catch (err) {
        console.error('Gagal memasukkan data:', err);
    }
}

// Contoh pemanggilan
tambahHadiah('hadiah-member-baru', 'sk-proj-tokenContoh123', 2);