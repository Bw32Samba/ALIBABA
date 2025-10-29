// ===== server.js =====
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const app = express();
const PORT = config.SERVER.PORT;
const WEB_NAME = config.SERVER.WEB_NAME;
const AUDIO_PATH = config.SERVER.AUDIO; // File JSON
const GMAIL_FILE = config.FILES.GMAIL; // Telegram Config
let GROUP_USERNAME = config.TELEGRAM.GROUP_USERNAME.startsWith("@")
  ? config.TELEGRAM.GROUP_USERNAME
  : "@" + config.TELEGRAM.GROUP_USERNAME;
let CHANNEL_USERNAME = config.TELEGRAM.CHANNEL_USERNAME.startsWith("@")
  ? config.TELEGRAM.CHANNEL_USERNAME
  : "@" + config.TELEGRAM.CHANNEL_USERNAME;

// ===== Middleware =====
// app.use("/assets", express.static(path.join(__dirname, "assets"))); // Hapus baris ini
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "supersecret123",
    resave: false,
    saveUninitialized: true,
  })
);

// ===== Helpers =====
function loadJSON(filePath, defaultValue) {
  if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath));
  fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  return defaultValue;
}
function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===== Data =====
let gmailList = loadJSON(GMAIL_FILE, []);
let bandingCount = {};

// ===== Middleware =====
function isVerified(req, res, next) {
  if (req.session.verified) return next();
  res.redirect("/verify/join");
}

// ===== HTML Template =====
function generateHTML(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body{margin:0;padding:0;font-family:Arial;background:#000;color:#fff;text-align:center;overflow:hidden;height:100vh;}
        @keyframes fall{0%{transform:translateY(-10px) rotate(0deg);opacity:1;}100%{transform:translateY(100vh) rotate(360deg);opacity:0;}}
        .star{position:absolute;width:2px;height:2px;background:white;opacity:0.8;animation-name:fall;animation-timing-function:linear;animation-iteration-count:infinite;}
        h1,h2{color:#00ffe0;text-shadow:0 0 5px #00ffe0;margin:10px;}
        input,button{padding:10px;margin:10px;width:250px;border-radius:5px;border:none;background-color:rgba(255,255,255,0.1);color:#fff;}
        button{background:#00ffe0;cursor:pointer;transition:background-color 0.3s;}
        button:hover{background-color:#00c8b0;}
        .container{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;}
        .logo{width:120px;height:120px;border-radius:50%;margin-bottom:20px;border:2px solid #00ffe0;}
        #history{max-height:200px;overflow-y:auto;display:none;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;margin:20px auto;width:80%;}
        #history ul{list-style:none;padding:0;}
        #history li{padding:5px;border-bottom:1px solid #555;color:#fff;}
    </style>
</head>
<body>
    <div class="container">
        <img src="/raju.jpg" class="logo"/>
        ${bodyContent}
    </div>
    <script>
        for(let i=0;i<50;i++){
            const s=document.createElement('div');
            s.className='star';
            s.style.left=Math.random()*100+'vw';
            s.style.animationDuration=(Math.random()*3+2)+'s';
            s.style.animationDelay=Math.random()*5+'s';
            document.body.appendChild(s);
        }
    </script>
</body>
</html>`;
}

// ===== Routes =====
// Halaman Join Grup & Channel
app.get("/verify/join", (req, res) => {
  const groupLink = `, '')}`;
  const channelLink = `, '')}`;
  const body = `<h1>${WEB_NAME}</h1><h2>Langkah Join Grup & Channel</h2>
    <p>Silakan join grup & channel Telegram admin:</p>
    <ul>
        <li><a href="${groupLink}" target="_blank">${GROUP_USERNAME}</a></li>
        <li><a href="${channelLink}" target="_blank">${CHANNEL_USERNAME}</a></li>
    </ul>
    <form method="POST" action="/verify/join"><button type="submit">Saya sudah join</button></form>`;
  res.send(generateHTML("Verifikasi Join Telegram", body));
});

app.post("/verify/join", (req, res) => {
  req.session.verified = true;
  res.redirect("/");
});

// Form Banding WA
app.get("/", isVerified, (req, res) => {
  const gmailWarning =
    gmailList.length === 0
      ? '<p style="color:red;">Belum ada Gmail tersimpan lewat bot Telegram.</p>'
      : "";
  const body = `<h1>${WEB_NAME}</h1><h2>Form Banding WA</h2>${gmailWarning}
    <input type="text" id="nomor" placeholder="Nomor WA" required /><br/>
    <input type="text" id="tujuan" placeholder="Tujuan Banding" required /><br/>
    <button id="kirim">Kirim Banding</button>
    <button id="toggleHistory">Lihat Riwayat Banding</button>
    <div id="result"></div>
    <div id="history"><ul id="historyList"></ul></div>
    <audio id="bgAudio" src="/raju.mp3" loop></audio>
    <script>
        let history=[];
        let bandingCounter=1;
        const historyList=document.getElementById('historyList');
        const historyDiv=document.getElementById('history');
        const toggleBtn=document.getElementById('toggleHistory');
        const resultDiv=document.getElementById('result');
        const audio=document.getElementById('bgAudio');

        document.body.addEventListener('click',()=>{audio.play().catch(()=>{});},{once:true});
        document.body.addEventListener('touchstart',()=>{audio.play().catch(()=>{});},{once:true});

        toggleBtn.addEventListener('click',()=>{
            if(historyDiv.style.display==='none'){
                historyDiv.style.display='block';
                toggleBtn.textContent='Sembunyikan Riwayat Banding';
            } else {
                historyDiv.style.display='none';
                toggleBtn.textContent='Lihat Riwayat Banding';
            }
        });

        document.getElementById('kirim').addEventListener('click', async ()=>{
            const nomor=document.getElementById('nomor').value;
            const tujuan=document.getElementById('tujuan').value;
            if(!nomor||!tujuan) return alert('Semua field wajib diisi!');

            resultDiv.textContent='Mengirim...';
            try {
                const res=await fetch('/banding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nomor,tujuan})});
                const json=await res.json();
                resultDiv.textContent=json.message;

                const entry={id:bandingCounter++,time:new Date().toLocaleTimeString(),nomor,tujuan,success:json.success};
                history.unshift(entry);
                historyList.innerHTML='';
                history.forEach(item=>{
                    const li=document.createElement('li');
                    li.innerHTML=\`<strong>\${item.id}.</strong> \${item.time} - \${item.nomor} -> \${item.tujuan} - <span style="color:\${item.success?'green':'red'}">\${item.success?'Sukses':'Gagal'}</span>\`;
                    historyList.appendChild(li);
                });

                document.getElementById('nomor').value='';
                document.getElementById('tujuan').value='';

            } catch(err) {
                resultDiv.textContent='Terjadi kesalahan: '+err.message;
            }
        });
    </script>`;
  res.send(generateHTML(WEB_NAME, body));
});

// Endpoint Banding
function buildArabicMessage(number) {
  return `مرحبا فريق دعم واتساب،
أرغب في الإبلاغ عن مشكلة في رقمي على واتساب. عند محاولة التسجيل، تظهر لي رسالة تفيد بأن "تسجيل الدخول غير متاح حالياً".
أرجو منكم مساعدتي في استعادة إمكانية استخدام رقمي [${number}] مجدداً. شكراً جزيلاً لكم.`;
}

app.post("/banding", isVerified, async (req, res) => {
  const { nomor, tujuan } = req.body;
  if (!nomor || !tujuan)
    return res
      .status(400)
      .json({ success: false, message: "Semua field wajib diisi!" });
  if (gmailList.length === 0)
    return res
      .status(400)
      .json({ success: false, message: "Belum ada Gmail tersimpan lewat bot Telegram." });

  const gmailData = gmailList[Math.floor(Math.random() * gmailList.length)];
  const key = `${nomor}|${gmailData.email}`;
  bandingCount[key] = (bandingCount[key] || 0) + 1;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: gmailData.email, pass: gmailData.appPassword },
  });

  try {
    await transporter.sendMail({
      from: gmailData.email,
      to: tujuan,
      subject: `Banding WA ${nomor}`,
      text: buildArabicMessage(nomor),
    });
    res.json({
      success: true,
      message: `🎉 Banding ${nomor} berhasil via ${gmailData.email} -> ${tujuan} (${bandingCount[key]})`,
    });
  } catch (err) {
    console.error("Gagal mengirim email:", err);
    res
      .status(500)
      .json({ success: false, message: `❌ Gagal kirim: ${err.message || "Unknown error"}` });
  }
});

// ===== Start Server =====
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Server berjalan di >:${PORT}`);
});
  
