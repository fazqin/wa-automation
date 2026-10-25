import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    // 1. Hubungkan ke database menggunakan connection string dari Environment Variables Vercel
    const sql = neon(process.env.DATABASE_URL);
    
    // Ambil ID hadiah dari URL (misal: /api/claim?id=token-ai-xyz)
    const { id } = req.query;
    const idHadiah = id || "token-ai-xyz";

    try {
        // 2. Ambil data hadiah dari database Neon
        const dataHadiah = await sql`SELECT * FROM klaim_hadiah WHERE id_hadiah = ${idHadiah}`;

        if (dataHadiah.length === 0) {
            return res.status(404).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif;">Maaf, link hadiah tidak valid atau sudah hangus!</h1>');
        }

        const hadiah = dataHadiah[0];

        // 3. Cek apakah kuota klik sudah habis atau penuh
        if (hadiah.current_views >= hadiah.max_views) {
            // Hapus data hadiah dari database demi privasi jika kuota sudah habis terpakai
            await sql`DELETE FROM klaim_hadiah WHERE id_hadiah = ${idHadiah}`;
            
            return res.status(404).send(`
                <h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">
                    Maaf, hadiah sudah habis diambil oleh 2 orang tercepat!
                </h1>
            `);
        }

        // 4. Tambahkan hitungan klik masuk (+1) ke database Neon
        const newViews = hadiah.current_views + 1;
        await sql`UPDATE klaim_hadiah SET current_views = ${newViews} WHERE id_hadiah = ${idHadiah}`;

        // Jika setelah klik ini kuota langsung penuh, jadwalkan penghapusan atau langsung hapus
        if (newViews >= hadiah.max_views) {
            await sql`DELETE FROM klaim_hadiah WHERE id_hadiah = ${idHadiah}`;
        }

        // 5. Tampilkan halaman HTML sukses untuk pemenang
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
                <h2 style="color:#2ecc71;">🎉 Selamat! Anda Berhasil Mengambil Hadiah</h2>
                <p>Silakan salin API Key Token AI Anda di bawah ini:</p>
                <div style="background:#f4f4f4; padding:15px; display:inline-block; border-radius:5px; font-family:monospace; font-size:18px; border: 1px solid #ccc;">
                    <strong>${hadiah.api_key_text}</strong>
                </div>
                <p style="color:gray; font-size:14px; margin-top:20px;">Link ini telah dibuka sebanyak ${newViews} dari ${hadiah.max_views} kali.</p>
            </div>
        `);

    } catch (error) {
        console.error(error);
        return res.status(500).send('<h1>Terjadi kesalahan internal pada server database.</h1>');
    }
}
