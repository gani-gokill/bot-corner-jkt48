const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const moment = require('moment-timezone');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Corner JKT48 Aktif! 💙'));
app.listen(PORT, () => console.log(`Web server jalan di port ${PORT}`));

const NAMA_SALURAN = "JKT48 Corner's✨Official";
const NAMA_SIGN = "JKT48 Corner's✨Official";
const CHECK_INTERVAL = 45000; // 45 detik

let sudahDiPost = new Set();
let clientReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('=== SCAN QR INI DI LOGS RENDER ===');
    qrcode.generate(qr, { small: true });
    console.log('Buka WhatsApp Nomor Bot > Perangkat Tertaut > Tautkan Perangkat');
});

client.on('ready', () => {
    console.log('✅ BOT SUDAH LOGIN! Mulai pantau IDN Live...');
    clientReady = true;
    mulaiPantau();
});

client.on('auth_failure', () => console.log('❌ Gagal login, perlu scan ulang'));
client.on('disconnected', (reason) => console.log('❌ Terputus:', reason));

async function cekLive() {
    if (!clientReady) return;
    try {
        console.log('🔍 Cek live...');
        let liveList = [];
        try {
            const res = await axios.get('https://api.jkt48live.com/api/live', { timeout: 15000 });
            liveList = res.data.data || res.data || [];
        } catch (e) {
            console.log('API utama mati, coba cadangan...');
            const res2 = await axios.get('https://jkt48live.com/api/live', { timeout: 15000 });
            liveList = res2.data.data || res2.data || [];
        }
        for (let member of liveList) {
            const platform = (member.platform || member.type || '').toLowerCase();
            if (platform !== 'idn' && platform !== 'idn_live') continue;
            const kunci = member.member_id + '_' + member.started_at;
            if (sudahDiPost.has(kunci)) continue;
            console.log(`🔴 ${member.name} LIVE!`);
            await kirimKeSaluran(member);
            sudahDiPost.add(kunci);
            setTimeout(() => sudahDiPost.delete(kunci), 3 * 60 * 60 * 1000);
        }
    } catch (err) {
        console.log('Gagal cek:', err.message);
    }
}

function buatPesan(member) {
    const waktu = moment(member.started_at || new Date()).tz('Asia/Jakarta');
    const hariMap = { Sunday: 'Minggu', Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu' };
    const hari = hariMap[waktu.format('dddd')] || waktu.format('dddd');
    const jam = waktu.format('DD MMM HH:mm');
    const linkIDN = member.link || member.url || `https://link.jkt48live.com/${member.slug || ''}`;
    const linkNoKomen = member.link_nocomment || linkIDN;
    return `Si *${member.name || member.member_name}* lagi IDN Live nih!\n\n✨${member.title || 'Hello'}✨\n\n⏰ ${hari}, ${jam} WIB\n🔗 IDN App ⤵\n  ⤷  ${linkIDN}\n🤐 Tanpa Komen&Gift ⤵\n  ⤷  ${linkNoKomen}\n🖥️ IDN Multi-viewer ⤵\n  ⤷  https://link.jkt48live.com/idn-multiview\n\nBiar makin seru, gaskeun!\n> ${NAMA_SIGN}`;
}

async function kirimKeSaluran(member) {
    try {
        const page = client.pupPage;
        const pesan = buatPesan(member);
        await page.goto('https://web.whatsapp.com/', { waitUntil: 'networkidle2' });
        await page.waitForTimeout(4000);
        await page.evaluate(() => {
            const btn = document.querySelector('span[data-icon="newsletter"]');
            if (btn) btn.click();
        });
        await page.waitForTimeout(2500);
        await page.evaluate((nama) => {
            const input = document.querySelector('div[contenteditable="true"]');
            if (input) { input.focus(); document.execCommand('insertText', false, nama); }
        }, NAMA_SALURAN);
        await page.waitForTimeout(2500);
        await page.evaluate((nama) => {
            const spans = [...document.querySelectorAll('span')];
            const target = spans.find(el => el.textContent.trim() === nama);
            if (target) target.click();
        }, NAMA_SALURAN);
        await page.waitForTimeout(2500);
        const terkirim = await page.evaluate((teks) => {
            const box = document.querySelector('footer div[contenteditable="true"]') || document.querySelector('div[contenteditable="true"][data-tab="10"]');
            if (!box) return false;
            box.focus();
            document.execCommand('insertText', false, teks);
            return true;
        }, pesan);
        if (!terkirim) { console.log('❌ Kotak chat saluran tidak ketemu'); return; }
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        console.log(`✅ Berhasil kirim ${member.name} ke saluran!`);
    } catch (err) {
        console.log('❌ Gagal kirim:', err.message);
    }
}

function mulaiPantau() {
    cekLive();
    setInterval(cekLive, CHECK_INTERVAL);
}

client.initialize();
