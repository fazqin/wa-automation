const express = require('express');
const app = express();
const PORT = 3000;

// Menyimpan data hadiah di memori server
let hadiahSingkat = {
    "token-ai-xyz": {
        apiKey: "INI_API_KEY_TOKEN_AI_RAHASIA_ANDA",
        maxViews: 2,
        currentViews: 0,
        viewedIPs: [] // opsional jika ingin mencatat IP unik
    }
};

app.get('/claim/:id', (req, res) => {
    const idHadiah = req.params.id;
    const hadiah = hadiahSingkat[idHadiah];

    // 1. Cek apakah link hadiah ada
    if (!hadiah) {
        return res.status(404).send('<h1>Maaf, link hadiah tidak valid atau sudah hangus!</h1>');
    }

    // 2. Ambil IP Address pengunjung
    const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // 3. Cek batas klik
    if (hadiah.currentViews < hadiah.maxViews) {
        hadiah.currentViews += 1;
        hadiah.viewedIPs.push(userIP);

        // Tampilkan halaman HTML yang rapi untuk pemenang
        res.send(`
            <div style="font-family:sans-serif; text-align:center; margin-top:50px;">
                <h2>🎉 Selamat! Anda Berhasil Mengambil Hadiah</h2>
                <p>Silakan salin API Key Token AI Anda di bawah ini:</p>
                <div style="background:#f4f4f4; padding:15px; display:inline-block; border-radius:5px; font-family:monospace; font-size:18px;">
                    <strong>${hadiah.apiKey}</strong>
                </div>
                <p style="color:red; font-size:12px;">Link ini telah dibuka sebanyak ${hadiah.currentViews} dari ${hadiah.maxViews} kali.</p>
            </div>
        `);

        // 4. Jika kuota habis setelah klik ini, langsung hapus dari memori
        if (hadiah.currentViews >= hadiah.maxViews) {
            delete hadiahSingkat[idHadiah];
        }
    } else {
        // Antisipasi jika ada jeda proses sebelum data terhapus
        delete hadiahSingkat[idHadiah];
        res.status(404).send('<h1>Maaf, hadiah sudah habis diambil oleh 2 orang tercepat!</h1>');
    }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
