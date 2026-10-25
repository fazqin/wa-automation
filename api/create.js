import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';

    // 1. Jika request POST: Simpan data dan tampilkan link hasil
    if (req.method === 'POST') {
        const { pesan, kuota } = req.body;
        const maxViews = parseInt(kuota, 10) || 1;
        // Generate random ID unik (8 karakter hex)
        const idHadiah = crypto.randomBytes(4).toString('hex');

        try {
            await sql`
                INSERT INTO klaim_hadiah (id_hadiah, pesan_teks, current_views, max_views)
                VALUES (${idHadiah}, ${pesan}, 0, ${maxViews})
            `;

            const linkKlaim = `${protocol}://${host}/api/claim?id=${idHadiah}`;

            res.setHeader('Content-Type', 'text/html');
            return res.status(200).send(`
                <div style="font-family:sans-serif; max-width:500px; margin:40px auto; padding:20px; border:1px solid #ddd; border-radius:8px;">
                    <h2 style="color:#2ecc71;">✅ Link Berhasil Dibuat!</h2>
                    <p>Batas Kuota Buka: <b>${maxViews} kali</b></p>
                    <label><b>Salin Link:</b></label>
                    <input type="text" value="${linkKlaim}" id="linkBox" style="width:100%; padding:10px; margin:10px 0; box-sizing:border-box;" readonly>
                    <button onclick="navigator.clipboard.writeText(document.getElementById('linkBox').value); alert('Link disalin!');" style="padding:10px 15px; background:#0070f3; color:#fff; border:none; border-radius:5px; cursor:pointer;">Salin Link</button>
                    <br><br>
                    <a href="/api/create" style="color:#666; text-decoration:none;">← Buat Pesan Baru Lagi</a>
                </div>
            `);
        } catch (error) {
            console.error(error);
            return res.status(500).send('Terjadi kesalahan saat menyimpan ke database.');
        }
    }

    // 2. Jika request GET: Tampilkan Form Input
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
        <div style="font-family:sans-serif; max-width:500px; margin:40px auto; padding:20px; border:1px solid #ddd; border-radius:8px;">
            <h2>🔐 Buat Pesan Rahasia Sekali Buka</h2>
            <form method="POST" action="/api/create">
                <label><b>Isi Pesan (Bebas: API Key, Base URL, Pesan Iseng):</b></label><br>
                <textarea name="pesan" rows="6" style="width:100%; margin:8px 0 15px 0; padding:10px; box-sizing:border-box; font-family:monospace;" placeholder="Base URL: https://...&#10;API Key: sk-...&#10;atau catatan rahasia lainnya..." required></textarea>
                
                <label><b>Batas Maksimal Dibuka (Kuota):</b></label><br>
                <input type="number" name="kuota" value="1" min="1" max="100" style="width:100%; margin:8px 0 20px 0; padding:10px; box-sizing:border-box;" required>
                
                <button type="submit" style="width:100%; padding:12px; background:#000; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">Generate Link</button>
            </form>
        </div>
    `);
}