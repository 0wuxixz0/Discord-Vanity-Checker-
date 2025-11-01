import tls from 'tls';
import http2 from 'http2';
import axios from 'axios';

const token = "MTQyNDQwODkzODU1NTc2ODg5Mw.G8APFS.BvHB102_BP9gLSn5E";
const password = 'ca2266';
const serverID = '  ';
const webhookURL = 'https://discord.com/api/webhooks/1427665217155891412/2tx5tX_91PBJYsoypbZzXWDh393RcumOocVqXKviEA2l8YXN6zyeASlcK5yRYreBFGVF';

const targetVanities = [' ', '  '];
let mfaT = '';

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Authorization': token,
  'Content-Type': 'application/json',
  'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRmlyZWZveCIsImRldmljZSI6IiIsInN5c3RlbV9sb2NhbGUiOiJ0ci1UUiIsImJyb3dzZXJfdXNlcl9hZ2VudCI6Ik1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQ7IHJ2OjEzMy4wKSBHZWNrby8yMDEwMDEwMSBGaXJlZm94LzEzMy4wIiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMzLjAiLCJvc192ZXJzaW9uIjoiMTAiLCJyZWZlcnJlciI6Imh0dHBzOi8vd3d3Lmdvb2dsZS5jb20vIiwicmVmZXJyaW5nX2RvbWFpbiI6Ind3dy5nb29nbGUuY29tIiwic2VhcmNoX2VuZ2luZSI6Imdvb2dsZSIsInJlZmVycmVyX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJjYW5hcnkiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNTYxNDAsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGwsImhhc19jbGllbnRfbW9kcyI6ZmFsc2V9'
};

const SESSION_SETTINGS = {
  settings: {
    enablePush: false,
    initialWindowSize: 1073741824,
    headerTableSize: 65536,
    maxConcurrentStreams: 1000,
    enableConnectProtocol: false
  },
  maxSessionMemory: 64000
};

const TLS_OPTIONS = {
  rejectUnauthorized: false,
  secureContext: tls.createSecureContext({
    secureProtocol: 'TLSv1_2_method'
  }),
  ALPNProtocols: ['h2']
};

class H2 {
  constructor() {
    this.s = http2.connect("https://canary.discord.com", {
      ...SESSION_SETTINGS,
      createConnection: () => tls.connect(443, 'canary.discord.com', TLS_OPTIONS)
    });
    this.s.on('error', () => setTimeout(() => { global.c = new H2(); }, 2000));
    this.s.on('close', () => setTimeout(() => { global.c = new H2(); }, 2000));
  }

  async executeRequest(m, p, h = {}, b = null) {
    return new Promise((rs, rj) => {
      const hs = {
        ...BASE_HEADERS,
        ...h,
        ":method": m,
        ":path": p,
        ":authority": "canary.discord.com",
        ":scheme": "https"
      };
      const s = this.s.request(hs);
      const c = [];
      s.on("data", d => c.push(d));
      s.on("end", () => {
        const responseBody = Buffer.concat(c).toString();
        rs(responseBody);
      });
      s.on("error", rj);
      if (b) s.write(typeof b === 'string' ? b : JSON.stringify(b));
      s.end();
    });
  }
}

global.c = new H2();

async function initialize() {
  try {
    const response = await global.c.executeRequest("PATCH", `/api/v9/guilds/${serverID}/vanity-url`,
      { 'Authorization': token, 'Content-Type': 'application/json' },
      { code: targetVanities[0] }
    );

    const data = JSON.parse(response || '{}');
    if (data.code === 60003 && data.mfa?.ticket) {
      console.log('[+] MFA yenileniyor...');
      const mfaResponse = await global.c.executeRequest(
        "POST",
        "/api/v9/mfa/finish",
        { 'Authorization': token, 'Content-Type': 'application/json' },
        { ticket: data.mfa.ticket, mfa_type: "password", data: password }
      );

      const mfaData = JSON.parse(mfaResponse || '{}');
      if (mfaData.token) {
        mfaT = mfaData.token;
        console.log('[+] MFA basariyla yenilendi');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.log('[-] MFA yenileme hatasi:', error.message);
    return false;
  }
}

async function sendWebhookAlert(v, isStatus = false) {
  if (!webhookURL) return;
  try {
    const message = isStatus ? {
      content: '',
      embeds: [{
        title: "Vanity Deneme",
        description: `\`\`\`${v} deneniyor...\`\`\``,
        color: 0x00ff00,
        timestamp: new Date().toISOString()
      }]
    } : {
      content: '@everyone',
      embeds: [{
        title: "? Vanity URL Alindi!",
        description: `\`\`\`${v} basariyla alindi!\`\`\``,
        color: 0x00ff00,
        fields: [
          { name: "URL", value: `\`${v}\``, inline: true },
          { name: "Sunucu", value: `\`${serverID}\``, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };
    await axios.post(webhookURL, message);
  } catch (e) {
    console.error(`[-] Webhook hatasi: ${e.message}`);
  }
}

async function tryVanity(vanity) {
  try {
    console.log(`[${new Date().toLocaleTimeString('tr-TR')}] ${vanity} deneniyor...`);
    await sendWebhookAlert(vanity, true);

    const response = await global.c.executeRequest('PATCH', `/api/v9/guilds/${serverID}/vanity-url`,
      {
        'Authorization': token,
        'Cookie': `__Secure-recent_mfa=${mfaT}`,
        'Content-Type': 'application/json'
      },
      { code: vanity }
    );

    const data = JSON.parse(response || '{}');

    if (data.code === vanity) {
      console.log(`[+] ? ${vanity} BASARIYLA ALINDI!`);
      await sendWebhookAlert(vanity);
      process.exit(0);
    } else if (data.message) {
      console.log(`[-] ${vanity} - ${data.message}`);
      if (data.message.includes('iki adimli')) {
        await initialize();
      }
    }
  } catch (error) {
    console.log(`[-] ${vanity} hata:`, error.message);
  }
}

async function tryAllVanities() {
  for (const vanity of targetVanities) {
    await tryVanity(vanity);
    await new Promise(res => setTimeout(res, 100));
  }
}

function scheduleAttempts() {
  setInterval(() => {
    const now = new Date();
    const minute = now.getMinutes();
    const second = now.getSeconds();

    // Her saatin 30. dakikasının 0. saniyesinde
    if (minute === 30 && second === 0) {
      console.log('\n[!] 30:00 - Tüm vanityler deneniyor...');
      tryAllVanities();
    }

    // Her saatin 30. dakikasının 30. saniyesinde
    if (minute === 30 && second === 30) {
      console.log('\n[!] 30:30 - Tüm vanityler deneniyor...');
      tryAllVanities();
    }
  }, 1000);
}

async function start() {
  console.log('[+] Discord Vanity Sniper Baslatildi');
  console.log('[+] Hedef Vanityler:', targetVanities.join(', '));
  console.log('[+] Deneme zamanlari: Her saatin 30:00 ve 30:30\'inda');
  console.log('[+] Sunucu ID:', serverID);
  console.log('-'.repeat(50));

  const success = await initialize();
  if (!success) {
    console.log('[-] Ilk MFA dogrulamasi basarisiz');
    process.exit(1);
  }

  setInterval(async () => {
    console.log('\n[+] MFA periyodik yenileme...');
    await initialize();
  }, 240000);

  scheduleAttempts();
  console.log('[+] Zamanlayici aktif, beklemede...\n');
}

start();
