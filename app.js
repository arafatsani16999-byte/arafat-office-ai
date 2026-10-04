// ================= CONFIG =================
const ADMIN_EMAIL = "arafatsani16999@gmail.com";
const ADMIN_PASS  = "arafat01875790164@@";
const PERMANENT_KEY = "iloveyoumababaff";
const FREE_LIMIT = 6; // Free user কতবার generate করতে পারবে

// ================= STATE =================
let currentUser = JSON.parse(localStorage.getItem("aoa_user") || "null");
let usage = JSON.parse(localStorage.getItem("aoa_usage") || "{}");
let deferredPrompt = null;

// ================= SCREEN =================
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ================= LOGIN =================
function doLogin(){
  const email = document.getElementById("loginEmail").value.trim();
  const pass  = document.getElementById("loginPass").value;
  const msg   = document.getElementById("loginMsg");

  if(email === ADMIN_EMAIL && pass === ADMIN_PASS){
    currentUser = { email, role:"admin", premium:true };
    localStorage.setItem("aoa_user", JSON.stringify(currentUser));
    enterApp();
  } else {
    msg.textContent = "❌ ভুল Email বা Password";
    msg.classList.remove("ok");
  }
}

function skipLogin(){
  const guestId = localStorage.getItem("aoa_guestId") || ("guest_"+Date.now());
  localStorage.setItem("aoa_guestId", guestId);
  currentUser = { email:guestId, role:"guest", premium:false };
  localStorage.setItem("aoa_user", JSON.stringify(currentUser));
  enterApp();
}

function logout(){
  localStorage.removeItem("aoa_user");
  currentUser = null;
  showScreen("loginScreen");
}

function enterApp(){
  document.getElementById("userLabel").textContent =
    currentUser.role === "admin" ? "Admin 👑" : (currentUser.premium ? "Premium ⭐" : "Free");
  showScreen("mainApp");
  updateQuotaInfo();
}

// ================= QUOTA =================
function getUsed(){ return usage[currentUser.email] || 0; }
function setUsed(n){ usage[currentUser.email] = n; localStorage.setItem("aoa_usage", JSON.stringify(usage)); }

function updateQuotaInfo(){
  const el = document.getElementById("quotaInfo");
  if(currentUser.premium || currentUser.role === "admin"){
    el.textContent = "✅ Unlimited prompts (Premium)";
    el.className = "msg ok";
  } else {
    const left = FREE_LIMIT - getUsed();
    el.textContent = `Free: বাকি আছে ${left}/${FREE_LIMIT}`;
    el.className = left > 0 ? "msg ok" : "msg";
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
  if(!apiKey){ alert("API Key দিন (Gemini বা OpenAI)"); return; }

  // Quota check
  if(!currentUser.premium && currentUser.role !== "admin"){
    if(getUsed() >= FREE_LIMIT){
      alert("Free limit শেষ! Premium Unlock করুন।");
      return;
    }
  }

  output.textContent = "⏳ AI ভাবছে... একটু অপেক্ষা করুন...";

  try {
    let code = "";
    if(provider === "gemini"){
      code = await callGemini(apiKey, promptText);
    } else {
      code = await callOpenAI(apiKey, promptText);
    }
    output.textContent = code;

    if(!currentUser.premium && currentUser.role !== "admin"){
      setUsed(getUsed()+1);
      updateQuotaInfo();
    }
  } catch(err){
    output.textContent = "❌ Error: " + err.message;
  }
}

// ---- Gemini ----
async function callGemini(apiKey, promptText){
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [{ text: buildSystemPrompt(promptText) }]
    }]
  };
  const res = await fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error?.message || "Gemini API Error");
  return data.candidates[0].content.parts[0].text;
}

// ---- OpenAI ----
async function callOpenAI(apiKey, promptText){
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+apiKey
    },
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
  return `তুমি একজন Expert Web Developer। নিচের চাহিদা অনুযায়ী একটি সম্পূর্ণ HTML File বানাও (CSS ও JS একই ফাইলে inline থাকবে)। শুধু কোড দাও, কোনো ব্যাখ্যা না।

User Request: ${userPrompt}

Output: একটি সম্পূর্ণ <!DOCTYPE html> ... </html> ফাইল।`;
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

// ================= PWA INSTALL =================
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
    alert("ℹ️ আপনার ব্রাউজার থেকে মেনু → 'Add to Home Screen' চাপুন।");
  }
}

// ================= SERVICE WORKER =================
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js");
}

// ================= INIT =================
if(currentUser) enterApp();
