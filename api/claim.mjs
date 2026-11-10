import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);

    // -------------------------------------------------------------
    // 1. HANDLER POST: Validasi Fingerprint Device & Ambil Hadiah
    // -------------------------------------------------------------
    if (req.method === 'POST') {
        const { id, visitorId } = req.body;

        if (!id || !visitorId) {
            return res.status(400).json({ success: false, message: 'Data request tidak lengkap.' });
        }

        try {
            const dataHadiah = await sql`SELECT * FROM klaim_hadiah WHERE id_hadiah = ${id}`;

            if (dataHadiah.length === 0) {
                return res.status(404).json({ success: false, message: 'Link tidak valid atau sudah hangus.' });
            }

            const hadiah = dataHadiah[0];
            const claimedDevices = Array.isArray(hadiah.claimed_devices) ? hadiah.claimed_devices : [];

            // A. Cek apakah perangkat ini sudah pernah mengklaim sebelumnya
            if (claimedDevices.includes(visitorId)) {
                return res.status(200).json({
                    success: true,
                    isRevisit: true,
                    pesan: hadiah.pesan_teks,
                    totalClaimed: claimedDevices.length,
                    maxViews: hadiah.max_views
                });
            }

            // B. Cek apakah kuota untuk orang tercepat sudah habis
            if (claimedDevices.length >= hadiah.max_views) {
                return res.status(403).json({
                    success: false,
                    message: `Maaf, kuota untuk ${hadiah.max_views} orang tercepat sudah habis!`
                });
            }

            // C. Perangkat baru & kuota masih ada: Daftarkan device ID
            const updatedDevices = [...claimedDevices, visitorId];
            const newCount = updatedDevices.length;

            await sql`
                UPDATE klaim_hadiah 
                SET 
                    claimed_devices = ${JSON.stringify(updatedDevices)}::jsonb,
                    current_views = ${newCount}
                WHERE id_hadiah = ${id}
            `;

            return res.status(200).json({
                success: true,
                isRevisit: false,
                pesan: hadiah.pesan_teks,
                totalClaimed: newCount,
                maxViews: hadiah.max_views
            });

        } catch (error) {
            console.error('Database Error:', error);
            return res.status(500).json({ success: false, message: 'Terjadi gangguan internal pada server.' });
        }
    }

    // -------------------------------------------------------------
    // 2. HANDLER GET: Halaman Klien + FingerprintJS Loader
    // -------------------------------------------------------------
    const { id } = req.query;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Klaim Pesan</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 85vh; }
        .card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: 100%; max-width: 480px; text-align: center; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0070f3; border-radius: 50%; width: 36px; height: 36px; animation: spin 0.8s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        pre { background: #0f172a; color: #f8fafc; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 14px; text-align: left; white-space: pre-wrap; word-break: break-word; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-warning { background: #fef9c3; color: #854d0e; }
        .error-msg { color: #dc2626; font-weight: 500; }
    </style>
</head>
<body>
    <div class="card" id="app">
        <h3>Memverifikasi Perangkat...</h3>
        <div class="spinner"></div>
        <p style="color: #64748b; font-size: 14px;">Memeriksa kuota dan validasi perangkat Anda.</p>
    </div>

    <!-- FingerprintJS Open Source CDN -->
    <script src="https://openfpcdn.io/fingerprintjs/v4"></script>
    <script>
        async function runClaim() {
            const container = document.getElementById('app');
            const urlParams = new URLSearchParams(window.location.search);
            const idHadiah = urlParams.get('id');

            if (!idHadiah) {
                container.innerHTML = '<h3 class="error-msg">Link tidak memiliki ID hadiah!</h3>';
                return;
            }

            try {
                // Inisialisasi FingerprintJS
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                const visitorId = result.visitorId;

                // Kirim ID hadiah dan visitorId perangkat ke server
                const response = await fetch('/api/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idHadiah, visitorId: visitorId })
                });

                const data = await response.json();

                if (!data.success) {
                    container.innerHTML = \`
                        <h3 class="error-msg">❌ Gagal Mengambil</h3>
                        <p style="color: #475569;">\${data.message}</p>
                    \`;
                    return;
                }

                // Tampilan jika klaim berhasil atau perangkat sudah pernah klaim
                const badgeHtml = data.isRevisit 
                    ? '<span class="badge badge-warning">Perangkat ini sudah pernah klaim</span>'
                    : '<span class="badge badge-success">🎉 Klaim Berhasil!</span>';

                container.innerHTML = \`
                    \${badgeHtml}
                    <h2 style="margin: 8px 0; color: #0f172a;">Isi Pesan</h2>
                    <p style="color: #64748b; font-size: 13px;">Tersisa slot terpakai: \${data.totalClaimed} dari \${data.maxViews}</p>
                    <pre>\${data.pesan}</pre>
                    <button onclick="navigator.clipboard.writeText(document.querySelector('pre').innerText); alert('Pesan berhasil disalin!');" style="padding: 10px 18px; background: #0070f3; color: #fff; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; margin-top: 10px; width: 100%;">Salin Pesan</button>
                \`;

            } catch (err) {
                container.innerHTML = '<h3 class="error-msg">Terjadi kesalahan koneksi saat verifikasi.</h3>';
                console.error(err);
            }
        }

        window.onload = runClaim;
    </script>
</body>
</html>
    `);
}