import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);
    const { id } = req.query;

    if (!id) {
        return res.status(400).send('<h1>Parameter ID tidak ditemukan.</h1>');
    }

    try {
        const dataHadiah = await sql`SELECT * FROM klaim_hadiah WHERE id_hadiah = ${id}`;

        if (dataHadiah.length === 0) {
            return res.status(404).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif;">Maaf, link tidak valid atau sudah hangus!</h1>');
        }

        const hadiah = dataHadiah[0];

        if (hadiah.current_views >= hadiah.max_views) {
            await sql`DELETE FROM klaim_hadiah WHERE id_hadiah = ${id}`;
            return res.status(404).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">Maaf, kuota pesan sudah habis!</h1>');
        }

        const newViews = hadiah.current_views + 1;
        await sql`UPDATE klaim_hadiah SET current_views = ${newViews} WHERE id_hadiah = ${id}`;

        if (newViews >= hadiah.max_views) {
            await sql`DELETE FROM klaim_hadiah WHERE id_hadiah = ${id}`;
        }

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
            <div style="font-family:sans-serif; max-width:600px; margin:40px auto; padding:20px; border:1px solid #ddd; border-radius:8px;">
                <h2 style="color:#2ecc71;">🎉 Pesan Berhasil Dibuka!</h2>
                <p>Isi Pesan / Konfigurasi:</p>
                <pre style="background:#f4f4f4; padding:15px; border-radius:5px; font-size:14px; white-space:pre-wrap; word-break:break-word; border:1px solid #ccc;">${hadiah.pesan_teks}</pre>
                <p style="color:gray; font-size:13px; margin-top:20px;">Link telah dibuka ${newViews} dari ${hadiah.max_views} kali.</p>
            </div>
        `);
    } catch (error) {
        console.error(error);
        return res.status(500).send('<h1>Terjadi kesalahan internal.</h1>');
    }
}