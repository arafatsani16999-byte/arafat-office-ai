// ================= CONFIG =================
const ADMIN_EMAIL = "arafatsani16999@gmail.com";
const ADMIN_PASS  = "arafat123";
const PERMANENT_KEY = "1234";
const FREE_LIMIT = 6;

// ================= STATE =================
let currentUser = JSON.parse(localStorage.getItem("aoa_user") || "null");
let usage = JSON.parse(localStorage.getItem("aoa_usage") || "{}");
let deferredPrompt = null;

// ================= SCREEN =================
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ================= LOGIN (শুধু Admin Gmail) =================
function doLogin(){
  const email = document.getElementById("loginEmail").value.trim();
  const msg   = document.getElementById("loginMsg");
  
  if(email === ADMIN_EMAIL){
    currentUser = { email, role:"admin", premium:true };
    localStorage.setItem("aoa_user", JSON.stringify(currentUser));
    enterApp();
  } else {
    msg.textContent = "❌ শুধু Admin Gmail দিয়ে Login করা যাবে";
  }
}

// Guest Login বন্ধ
function skipLogin(){
  alert("❌ Guest Login বন্ধ আছে। Admin হিসেবে Login করুন।");
}

function logout(){
  localStorage.removeItem("aoa_user");
  currentUser = null;
  showScreen("loginScreen");
}

function enterApp(){
  document.getElementById("userLabel").textContent =
    currentUser.role === "admin" ? "Admin 👑" : "User";
  showScreen("mainApp");
  updateQuotaInfo();
  loadSavedKey();
}

// ================= QUOTA =================
function getUsed(){ return usage[currentUser.email] || 0; }
function setUsed(n){ usage[currentUser.email] = n; localStorage.setItem("aoa_usage", JSON.stringify(usage)); }

function updateQuotaInfo(){
  const el = document.getElementById("quotaInfo");
  if(currentUser.role === "admin" || currentUser.premium){
    el.textContent = "✅ Unlimited prompts (Admin)";
    el.className = "msg ok";
  } else {
    const left = FREE_LIMIT - getUsed();
    el.textContent = `Free: বাকি আছে ${left}/${FREE_LIMIT}`;
    el.className = left > 0 ? "msg ok" : "msg";
  }
}

// ================= API KEY MANAGEMENT =================
function toggleKeyView(){
  const inp = document.getElementById("apiKey");
  const btn = document.getElementById("eyeBtn");
  if(inp.type === "password"){
    inp.type = "text";
    btn.textContent = "🙈";
  } else {
    inp.type = "password";
    btn.textContent = "👁️";
  }
}

function saveKey(key){
  const remember = document.getElementById("rememberKey").checked;
  if(remember){
    localStorage.setItem("aoa_api_key", key);
    localStorage.setItem("aoa_api_provider", document.getElementById("apiSelect").value);
    document.getElementById("keyStatus").textContent = "✅ Key সেভ হয়েছে";
  } else {
    localStorage.removeItem("aoa_api_key");
    document.getElementById("keyStatus").textContent = "";
  }
}

function loadSavedKey(){
  const saved = localStorage.getItem("aoa_api_key");
  const provider = localStorage.getItem("aoa_api_provider");
  if(saved){
    document.getElementById("apiKey").value = saved;
    if(provider) document.getElementById("apiSelect").value = provider;
    document.getElementById("keyStatus").textContent = "✅ সেভ করা Key লোড হয়েছে";
  }
}

// ================= PREMIUM =================
function activatePremium(){
  const key = prompt("Permanent Key দিন:");
  if(key === PERMANENT_KEY){
    currentUser.premium = true;
    localStorage.setItem("aoa_user", JSON.stringify(currentUser));
    document.getElementById("userLabel").textContent = "Premium ⭐";
    updateQuotaInfo();
    alert("🎉 Premium Activated!");
  } else {
    alert("❌ ভুল Key");
  }
}

// ================= GENERATE =================
async function generateCode(){
  const promptText = document.getElementById("promptInput").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const provider = document.getElementById("apiSelect").value;
  const output = document.getElementById("codeOutput");

  if(!promptText){ alert("Prompt লিখুন!"); return; }
  if(!apiKey){ alert("API Key দিন"); return; }

  saveKey(apiKey);

  if(currentUser.role !== "admin" && !currentUser.premium){
    if(getUsed() >= FREE_LIMIT){ alert("Free limit শেষ! Premium Unlock করুন।"); return; }
  }

  output.textContent = "⏳ AI ভাবছে... একটু অপেক্ষা করুন...";

  try {
    let code = "";
    if(provider === "gemini") code = await callGemini(apiKey, promptText);
    else code = await callOpenAI(apiKey, promptText);
    output.textContent = code;

    if(currentUser.role !== "admin" && !currentUser.premium){
      setUsed(getUsed()+1);
      updateQuotaInfo();
    }
  } catch(err){
    output.textContent = "❌ Error: " + err.message;
  }
}

// ---- Gemini (Multi-Model Auto Try) ----
async function callGemini(apiKey, promptText){
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
    "gemini-flash-latest",
    "gemini-1.5-flash-latest",
    "gemini-pro"
  ];

  let lastError = "";

  for(const model of models){
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ contents: [{ parts: [{ text: buildSystemPrompt(promptText) }] }] })
      });
      const data = await res.json();

      if(res.ok && data.candidates && data.candidates[0]){
        return data.candidates[0].content.parts[0].text;
      }
      lastError = data.error?.message || "Error";
    } catch(e){
      lastError = e.message;
    }
  }

  throw new Error("সব Model Fail। শেষ Error: " + lastError);
}

// ---- OpenAI ----
async function callOpenAI(apiKey, promptText){
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+apiKey },
    body: JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        { role:"system", content:"You are a website/app code generator. Always return a single complete HTML file with inline CSS and JS. No explanations." },
        { role:"user", content: promptText }
      ]
    })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error?.message || "OpenAI API Error");
  return data.choices[0].message.content;
}

function buildSystemPrompt(userPrompt){
  return `তুমি একজন Expert Web Developer। নিচের চাহিদা অনুযায়ী একটি সম্পূর্ণ HTML File বানাও (CSS ও JS একই ফাইলে inline থাকবে)। শুধু কোড দাও, কোনো ব্যাখ্যা না।\n\nUser Request: ${userPrompt}\n\nOutput: একটি সম্পূর্ণ <!DOCTYPE html> ... </html> ফাইল।`;
}

// ================= UTILS =================
function copyCode(){
  const txt = document.getElementById("codeOutput").textContent;
  navigator.clipboard.writeText(txt).then(()=> alert("✅ Copy হয়েছে!"));
}

function downloadCode(){
  const txt = document.getElementById("codeOutput").textContent;
  const blob = new Blob([txt], { type:"text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "arafat-ai-generated.html";
  a.click();
}

function previewCode(){
  const txt = document.getElementById("codeOutput").textContent;
  document.getElementById("previewFrame").srcdoc = txt;
  document.getElementById("previewModal").classList.add("open");
}
function closePreview(){
  document.getElementById("previewModal").classList.remove("open");
}

// ================= PWA =================
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
});

function installApp(){
  if(deferredPrompt){
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(c => {
      if(c.outcome === "accepted") alert("✅ App Install হয়েছে!");
      deferredPrompt = null;
    });
  } else {
    alert("ℹ️ ব্রাউজার মেনু → 'Add to Home Screen' চাপুন।");
  }
}

// ================= SERVICE WORKER =================
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

// ================= INIT =================
if(currentUser) enterApp();
